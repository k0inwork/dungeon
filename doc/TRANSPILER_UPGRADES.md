# AetherTranspiler Enhancement Proposal

## 1. Problem Statement

Aethelgard's `AetherTranspiler` translates a strict subset of JavaScript (AJS) into WebAssembly Forth for kernel execution. While highly performant and memory-isolated, the current transpiler has two major flaws that severely hinder our goal of dynamic, LLM-generated logic:

1.  **The "Black Box" Debugging Problem:** When a compiled Forth kernel crashes or behaves incorrectly (e.g., stack underflow, invalid memory access), the error is nearly impossible to trace back to the original AJS line. The Forth environment only throws generic `EXEC ERROR` or `word not supported in interpret mode` errors.
2.  **Syntax Brittleness:** AJS lacks support for common programming constructs (dynamic arrays, standard `for` loops, nested loops, complex `if/else`, `switch` statements, strings). This makes it extremely difficult for an LLM to generate code without encountering compilation errors.

## 2. Proposal 1: The "Debug Mode" Transpiler

To solve the "Black Box" problem, we propose adding a configurable `debug_mode` to the `AetherTranspiler`. When enabled, the transpiler will weave execution tracing instructions directly into the generated Forth dictionary.

### A. Line Number Emitting
The transpiler (using Acorn AST data) knows the exact line number of every AJS statement.
In `debug_mode`, the transpiler will prepend a special `JS_TRACE` host function call to every major AST block execution.

**Example AJS:**
```javascript
function skill_fireball(tgtId) {
    let dmg = 40;                     // Line 2
    rpg_table[tgtId].hp -= dmg;       // Line 3
    return rpg_table[tgtId].hp;       // Line 4
}
```

**Proposed Debug Forth Output:**
```forth
: SKILL_FIREBALL
  ( -- Line 2 -- )
  2 JS_TRACE
  40 LV_SKILL_FIREBALL_DMG !

  ( -- Line 3 -- )
  3 JS_TRACE
  LV_SKILL_FIREBALL_DMG @ NEGATE
  LV_SKILL_FIREBALL_TGTID @
  RPG_TABLE SWAP SIZEOF_RPGENTITY * +
  OFF_RPGENTITY_HP + +!

  ( -- Line 4 -- )
  4 JS_TRACE
  LV_SKILL_FIREBALL_TGTID @
  RPG_TABLE SWAP SIZEOF_RPGENTITY * +
  OFF_RPGENTITY_HP + @
  EXIT
;
```

### B. Stack Depth Verification
Forth is stack-based. The most common crash is a stack imbalance.
The transpiler should track the expected stack depth locally and inject assertions.
```forth
  ( Ensure Stack Depth is exactly X after an assignment )
  DEPTH X = JS_ASSERT_STACK
```

### C. Host Integration (`JS_TRACE` & `JS_ASSERT_STACK`)
We will add these functions to `WaForthService.ts` via the `bindHostFunctions()` method. When the kernel runs, the Host will log the last executed line number. If the kernel crashes, the Host can immediately point the developer (or the LLM) to the exact line of AJS that caused the fault.

---

## 3. Proposal 2: Upgrading AJS Syntax Support

To allow LLMs to freely generate logic, AJS needs to be less brittle. We propose the following transpilation upgrades:

### A. Complex Boolean Expressions & Control Structures
Currently, AJS only reliably supports simple conditions like `if (a < b)`. Complex compound expressions fail because mapping JavaScript's Infix notation (`a && b || c`) to Forth's Postfix (Reverse Polish Notation) (`a b AND c OR`) requires deep Abstract Syntax Tree (AST) traversal.
*   **Goal:** Support complex logical expressions like `if ((hp < 50 && is_poisoned) || distance > 10)`.
*   **Implementation:** The transpiler must recursively traverse `LogicalExpression` (`&&`, `||`) and `BinaryExpression` (`<`, `==`) nodes in the Acorn AST.
    *   Left side is compiled first (pushes to stack).
    *   Right side is compiled next (pushes to stack).
    *   The operator is emitted (`AND`, `OR`, `<`, `=`).
    *   *Short-Circuiting:* In JS, `a && b` stops evaluating if `a` is false. Forth's bitwise `AND` does not. The transpiler must optionally wrap the right side in an `IF` block to mirror standard JS short-circuit behavior if function calls with side-effects are present.

### B. Robust Loop Structures (`for...of`)
Currently, only `while` and a strictly formatted `for(let i=0; i<N; i++)` are supported, utilizing Forth's rigid `DO ... LOOP`.
*   **Goal:** Add AST transpilation for `for (let item of arr)` loops to iterate over both Fixed and Dynamic Arrays efficiently.
*   **Implementation:** The transpiler will generate entirely different Forth loops depending on the array's type to guarantee O(N) traversal.
    1.  **Fixed Arrays (Flat Memory):** The transpiler generates a simple index-offset loop.
        *   It maintains a `ptr = base_address` and an `end_ptr`.
        *   `BEGIN ptr end_ptr < WHILE ... ptr item_size +! REPEAT`.
    2.  **Dynamic Arrays (Chunked Linked-List):** Using `ARRAY_GET_ADDR(index)` for every item is highly inefficient because it re-traverses the linked list from the head every time. Instead, the transpiler generates a specialized, highly optimized chunk-traversing loop.
        *   The loop maintains `current_chunk_ptr`, `internal_index` (0 to 63), and `items_processed`.
        *   `BEGIN items_processed total_length < WHILE`
        *   `item = current_chunk_ptr + metadata_size + (internal_index * item_size)`
        *   Execute loop body.
        *   Increment `internal_index` and `items_processed`.
        *   `IF internal_index == 64 THEN` -> Follow `next_chunk` pointer, update `current_chunk_ptr`, reset `internal_index = 0`.
        *   `REPEAT`
        *   *Result:* True O(N) traversal with zero redundant chunk hopping.

### C. Enhanced Control Flow (`switch`)
*   **Goal:** Support `switch (expr) { case A: ... }`.
*   **Implementation:** Map `switch` statements to a series of Forth `OVER = IF ... ELSE ... THEN` blocks or use an execution token array (jump table) for large switch cases (O(1) dispatching). This is vital for the `BattleKernel` dispatch table.

### D. Closure Support (Architectural Decision: UNSUPPORTED)
*   **Question:** Could we support Closures by fixing the local variable stack position of the enclosing variable and transpiling it correctly?
*   **The Problem:** In Forth (and C), local variables live on the Return Stack. If Function A declares `let x = 10`, creates a closure Function B that uses `x`, and then Function A returns, the stack frame for `x` is destroyed. If Function B is executed later (e.g., as an event callback), it will read garbage memory because the original stack position of `x` is gone.
*   **The Theoretical Solution:** To make closures work, the AetherTranspiler would need to perform **Closure Hoisting / Environment Allocation**.
    1.  When the transpiler detects a closure, it must automatically allocate a hidden `Environment Struct` on the **Heap** (using our new Chunked Allocation strategy).
    2.  It must copy `x` from the stack into this Heap Environment.
    3.  The closure function (Function B) is transpiled to accept a hidden pointer to this Heap Environment as its first argument.
*   **Conclusion:** While technically possible, this adds massive complexity to the transpiler and introduces hidden heap allocations that the developer (or LLM) cannot predict, violating AJS's core philosophy of deterministic, high-performance, predictable memory layouts. Therefore, **Closures will remain officially unsupported in AJS**. Developers and LLMs must use Global Structs, Arrays, or VSOs for state sharing across callbacks.

### C. First-Class Array Abstractions (Chunked Linked-List Allocation)
Currently, arrays in AJS are strict, manually allocated, fixed-size contiguous memory blocks (e.g., `new Uint32Array(0x40000)`). While contiguous memory is perfect for dense maps (like VRAM or Physics Grids), dynamic lists (like an entity's status effects) suffer heavily from memory fragmentation in WebAssembly if we try to use standard `malloc/realloc`.

*   **Goal:** Introduce a dynamic Array type abstraction that the LLM can use safely and dynamically grow without fragmentation: `let arr = [1, 2, 3]; arr.push(4);`.
*   **Syntax Distinction:** The transpiler must distinguish between Fixed Flat Memory and Dynamic Arrays based on initialization:
    1.  **Fixed Arrays:** `const MAP = new Uint32Array(0x40000);`. The transpiler tracks this as a raw pointer. `MAP[i]` compiles to standard pointer arithmetic (`0x40000 + (i * 4)`).
    2.  **Dynamic Arrays:** `let arr = [1, 2, 3];` or `let arr = [];`. The transpiler tracks this variable's type as a `DynamicArray` Fat Pointer.
*   **Implementation:** Instead of contiguous reallocation, we propose a **Chunked Linked-List Allocation Strategy** for Dynamic Arrays.
    *   The kernel firmware (`SharedBlocks.ts`) pre-allocates a large "Heap" divided into fixed-size chunks (e.g., 64 bytes each).
    *   A dynamic array is instantiated as a "Fat Pointer" struct: `{ head_ptr: Address, tail_ptr: Address, total_length: Cell }`.
    *   Each chunk in the list holds metadata (a `next_chunk` pointer) followed by a fixed number of data cells (e.g., `CHUNK_CAPACITY = 64`).
    *   When the transpiler sees `arr.push(val)`, it appends the value to the current `tail_chunk`. If the chunk is full, the firmware instantly pops a free chunk from a global Free-List (O(1) allocation), updates `tail_ptr->next_chunk`, and writes the new value.
    *   This makes dynamic growth fast, deterministic, and completely immune to fragmentation.
    *   **Dynamic Indexing (`arr[i]`):** Because the transpiler knows `arr` is a `DynamicArray`, it intercepts the array access.
        *   Instead of raw pointer math, it injects a special Forth word (e.g., `ARRAY_GET_ADDR`).
        *   Since `CHUNK_CAPACITY` is a power of 2 (e.g., 64), calculating the target chunk is a fast bitwise shift (`index >> 6`), and finding the internal offset is a bitwise AND (`index & 63`).
        *   `ARRAY_GET_ADDR` hops through the `next_chunk` pointers `target_chunk` times, then returns the raw memory address at `chunk_data_ptr + (offset * element_size)`. While traversing takes a few operations, the depth of the linked list is shallow, making this O(N/64) lookup extremely fast in WebAssembly.

### D. Safe Arithmetic Logging
Currently, `Log(number)` prints the number to standard output. We should introduce string interpolation for logging to make debugging and narrative generation easier:
*   **Goal:** Support `Log(\`Dealt \${dmg} damage to \${tgtId}\`)`.
*   **Implementation:** The transpiler breaks the template literal into chunks:
    `S" Dealt " JS_LOG  LV_DMG @ .N  S"  damage to " JS_LOG  LV_TGTID @ .N`.

## 4. Execution Plan
1.  **Phase 1:** Implement the `debug_mode` tracing in `AetherTranspiler.ts` and bind the `JS_TRACE` function in `WaForthService.ts`. Validate by intentionally throwing an error in `BattleKernel.ts`.
2.  **Phase 2:** Implement robust `switch` statement AST parsing mapping to Forth `IF/ELSE` chains. Update the `BattleKernel` dispatch logic to use `switch`.
3.  **Phase 3:** Introduce the Bump Allocator to the Forth Firmware and implement the "Fat Pointer" array abstraction.
4.  **Phase 4:** Expose these new capabilities to the LLM context prompt in `GeneratorService.ts`.