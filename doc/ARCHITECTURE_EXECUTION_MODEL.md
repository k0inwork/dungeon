
# ARCHITECTURAL DECISION RECORD: EXECUTION MODEL

> **Topic:** Handling AI-Generated Logic Modules (Kernels)
> **Date:** Current
> **Status:** ANALYSIS PHASE

## 1. THE CORE CONFLICT
The engine currently operates on a **Hybrid Architecture**:
1.  **Host:** React (UI, Input, Network).
2.  **Guest:** WAForth (Physics, Logic, State).
3.  **Bridge:** `AetherTranspiler` (Converts AI-JS to Forth).

**The Question:** Should we maintain this complex Transpiler pipeline, or switch to executing AI code as raw JavaScript inside a Sandbox (e.g., Web Worker)?

---

## OPTION A: THE CURRENT STACK (AetherJS -> Forth -> Wasm)

### Mechanism
The AI generates constrained JavaScript. We parse the AST and emit Forth code. This code is compiled by WAForth into WebAssembly instructions at runtime.

### ✅ The Advantages (Why we chose this)
1.  **The "Snapshot" Capability (Crucial):**
    *   In Wasm, the entire game state exists in a single `ArrayBuffer` (Linear Memory).
    *   **Save/Load:** `localStorage.setItem('save', wasmMemory.buffer)`. Done.
    *   **Time Travel:** We can implement "Undo Turn" by simply copying the buffer.
    *   *Contrast:* In Pure JS, game state is scattered across the Heap (Objects, Closures, Prototype chains). Serializing a complex JS game state to JSON is slow and error-prone (circular references, functions).

2.  **Zero-Copy Rendering:**
    *   The React Host renders the grid by creating a `Uint32Array` view directly into Wasm memory (`0x80000`).
    *   There is no data marshalling. The "Video Card" reads the "RAM" directly.

3.  **Synchronous Determinism:**
    *   The Wasm simulation is strictly single-threaded and blocking.
    *   We can run 10,000 ticks in a loop for "World Generation" without yielding to the Event Loop, ensuring atomic operations.

4.  **Security Sandbox:**
    *   Wasm code **cannot** touch the DOM, LocalStorage, or Network unless we explicitly bind a function.
    *   Malicious AI code (`while(true)`) can be caught by an instruction counter (in theory) or simply killing the Wasm instance.

### ❌ The Discrepancies & Pain Points
1.  **The Transpiler Bottleneck:**
    *   Writing a Compiler is hard. We are currently transpiling `if/else` and `let` manually.
    *   **Gap:** We barely support loops or complex boolean logic (`if (a && b)`).
    *   **Risk:** The AI writes valid JS that fails to transpile because our Transpiler is too simple.

2.  **Debugging Hell:**
    *   Error: `undefined word: UPDATE_X`.
    *   Developer has to map this back to the generated Forth, and then back to the source AetherJS.
    *   **Gap:** No Source Maps.

---

## OPTION B: THE JS SANDBOX (Web Workers / Realms)

### Mechanism
The AI generates standard JavaScript. We load it into a `new Worker(blob)` or a constrained `iframe`.

### ✅ The Advantages
1.  **Native Syntax:**
    *   The AI knows JavaScript perfectly. It can use `Math.sin()`, `Array.map()`, `Objects`.
    *   No transpilation errors.

2.  **Development Velocity:**
    *   We delete `src/compiler/`.
    *   We delete `grid_core.fs`.
    *   We write physics in TypeScript.

### ❌ The Discrepancies & Risks
1.  **The Serialization Nightmare:**
    *   How do you save the game? You have to manually write `toJSON()` methods for every Entity, Tile, and Component.
    *   Forget one property, and the Save file is corrupt.

2.  **The Rendering Bottleneck:**
    *   A Web Worker cannot draw to the Main Thread's Canvas directly (without `OffscreenCanvas`, which has varied support).
    *   You must `postMessage(HugeArray)` every frame. This copies memory, causing Garbage Collection stutter.

3.  **Async Complexity:**
    *   Workers are async. Requesting "Move Entity" requires `await worker.postMessage()`.
    *   This breaks the "Immediate Mode" feel of the engine.

---

## 3. VERDICT & IMPROVEMENT PLAN

**Decision:** Stay with **Option A (Wasm/Forth)**.
The benefits of **Linear Memory (Save States/Rendering)** outweigh the pain of maintaining the Transpiler. The "Aethelgard" identity is built on this "Retro-Computer" architecture.

### Room for Improvement (The Action Plan)

1.  **Strengthen the Transpiler:**
    *   **Current Gap:** The Transpiler emits flat code.
    *   **Fix:** Implement a proper **Symbol Table**. Track variable types.
    *   **Fix:** Support `&&` and `||` logic in the AST Walker.

2.  **Better Debugging:**
    *   **Gap:** Users see Forth errors.
    *   **Fix:** The Transpiler should verify variable existence *before* emitting Forth. (e.g., "Error: Variable 'hp' used but not defined in AetherJS").

3.  **The Standard Library:**
    *   **Gap:** We are reimplementing math in every script.
    *   **Fix:** Inject a `std_lib.ajs` header into every transpilation that defines `Math.max`, `Math.min`, `Random.range`.

4.  **Syntax Relaxing:**
    *   Allow the AI to write `x = x + 1`. Currently, our Forth logic might require strict assignments. Ensure the AST handles `AssignmentExpression` robustly.
