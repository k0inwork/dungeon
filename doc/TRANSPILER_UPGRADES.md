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

### A. Robust Loop Structures
Currently, only `while` and a strictly formatted `for(let i=0; i<N; i++)` are supported.
*   **Goal:** Add AST transpilation for `for...of` (for iterating over VSO Struct Arrays) and standard arbitrary `for` loops.
*   **Implementation:** The transpiler must map arbitrary loop conditions into Forth's `BEGIN ... WHILE ... REPEAT` structure rather than relying solely on the fragile `DO ... LOOP` limits.

### B. Enhanced Control Flow (`switch`)
*   **Goal:** Support `switch (expr) { case A: ... }`.
*   **Implementation:** Map `switch` statements to a series of Forth `OVER = IF ... ELSE ... THEN` blocks or use an execution token array (jump table) for large switch cases (O(1) dispatching). This is vital for the `BattleKernel` dispatch table.

### C. First-Class Array Abstractions (Chunked Linked-List Allocation)
Currently, arrays in AJS are strict, manually allocated, fixed-size contiguous memory blocks (e.g., `new Uint32Array(0x40000)`). Contiguous allocation (like standard `malloc/realloc`) suffers heavily from memory fragmentation in WebAssembly's linear memory.
*   **Goal:** Introduce a dynamic Array type abstraction that the LLM can use safely and dynamically grow without fragmentation: `let arr = [1, 2, 3]; arr.push(4);`.
*   **Implementation:** Instead of contiguous reallocation, we propose a **Chunked Linked-List Allocation Strategy**.
    *   The kernel firmware (`SharedBlocks.ts`) pre-allocates a large "Heap" divided into fixed-size chunks (e.g., 64 bytes each).
    *   An AJS dynamic array is a "Fat Pointer" struct: `{ head_ptr: Address, tail_ptr: Address, total_length: Cell }`.
    *   Each chunk in the list holds metadata (a `next_chunk` pointer) followed by a fixed number of data cells (e.g., `CHUNK_CAPACITY = 64`).
    *   When the transpiler sees `arr.push(val)`, it appends the value to the current `tail_chunk`. If the chunk is full, the firmware instantly pops a free chunk from a global Free-List (O(1) allocation), updates `tail_ptr->next_chunk`, and writes the new value.
    *   This makes dynamic growth fast, deterministic, and completely immune to fragmentation.
    *   **Dynamic Indexing (`arr[i]`):** Because memory is non-contiguous, array access requires resolving the target chunk.
        *   The transpiler will inject a special Forth word (e.g., `ARRAY_GET_ADDR`).
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