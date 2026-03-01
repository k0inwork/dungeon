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

### C. First-Class Array Abstractions (The "Fat Pointer")
Currently, arrays in AJS are manual memory pointers (`new Uint32Array(0x40000)`).
*   **Goal:** Introduce a dynamic Array type abstraction that the LLM can use safely: `let arr = [1, 2, 3]; arr.push(4);`.
*   **Implementation:** The transpiler will allocate a block in the kernel's memory heap (we will need to implement a basic `malloc`/`free` or bump allocator in the `SharedBlocks.ts` firmware).
    *   An array in AJS will be a "Fat Pointer" struct: `{ ptr: Address, length: Cell, capacity: Cell }`.
    *   When the transpiler sees `arr.push(val)`, it emits Forth code to write to `ptr + length`, increment `length`, and (if necessary) reallocate.

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