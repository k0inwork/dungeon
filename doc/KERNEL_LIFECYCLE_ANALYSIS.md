
# KERNEL LIFECYCLE & ARCHITECTURE ANALYSIS

## 1. THE "IDLE" MYTH
**Question:** Why distinguish between "Active" and "Idle" kernels if Wasm sleeps by default?

**Answer:**
You are correct that Wasm execution is synchronous and event-driven. It consumes **zero resources** when not executing a specific function call.

We track the **"Ready State"**, not the "Execution State".

### The Lifecycle States
1.  **VOID (Null):** The `ForthProcess` object exists in JS, but `WAForth` has not been instantiated. Memory: 0MB.
2.  **BOOTING (Hardware Init):** `new WAForth()` is called. `waforth.wasm` is fetched and compiled by the browser. Memory: 1MB (Default).
3.  **COMPILING (Software Install):** We feed the Source Code (`grid_core.fs` or `script.ajs`) into the interpreter. The Wasm engine generates bytecode for every function (`: MOVE_ENTITY ... ;`).
4.  **READY (Active):** The Dictionary is populated. The Kernel is now safe to receive the `PROCESS_INBOX` command.
    *   *Note:* If `tickSimulation()` calls a kernel before it reaches this state, the app crashes. This is why we need the `activeKernels` set in `App.tsx`.

---

## 2. AETHERJS TRANSPILER STRATEGY

### 2.1 AST vs Regex
We have adopted **AST Parsing** (via `acorn`).
*   **Why:** Regex fails on nested logic (`if (a) { if (b) {} }`). AST handles the tree structure natively.
*   **Implementation:** `src/compiler/AetherTranspiler.ts` uses a recursive visitor pattern to walk the tree and emit Forth.

### 2.2 Variable Memory Model
We compared two approaches for handling `let x = 10` inside `function Update()`:

#### Approach A: Dynamic Stack Frames (The C Way)
Allocating memory on the Return Stack or Heap at function start.
*   `VARIABLE STACK_PTR`
*   `: UPDATE 3 CELLS ALLOT ... (Logic) ... 3 CELLS FREE ;`
*   **Pros:** Supports Recursion.
*   **Cons:** Slow (allocation overhead). Hard to debug (variables are just offsets like `SP + 4`).

#### Approach B: Global Mangling (The Static Way) - **SELECTED**
Renaming local variables to unique globals during transpilation.
*   JS: `function Update() { let x = 10; }`
*   Forth: `VARIABLE UPDATE_X  : UPDATE 10 UPDATE_X ! ;`
*   **Pros:** O(1) Access speed. Variables are named in memory dumps.
*   **Cons:** No Recursion (calling `Update` from `Update` would overwrite `x`).
*   **Verdict:** Since Game Logic scripts are almost never recursive, this offers the best performance and debugging experience.

---

## 3. MIGRATION STRATEGY: .FS to .AJS

To migrate the existing kernels (`GridKernel.ts`) to AetherJS (`.ajs`), we propose a phased rollout.

### Phase 1: Logic Extraction
Move the *internal logic* words to AJS, keep the *infrastructure* in Forth.

*   **Keep in Forth:** Memory Offsets, Low-level IO (`BUS_SEND`), Graphics (`DRAW_CELL`).
*   **Move to AJS:** AI Decisions, Movement Rules, Damage Calculations.

### Phase 2: The Aether Standard Library
We need to expose the Low-Level words as AJS intrinsics.
*   `Memory.read(addr)` -> `@`
*   `Memory.write(addr, val)` -> `!`
*   `Video.draw(x, y, char, color)` -> `DRAW_CELL`

### Phase 3: Full Replacement
Once the Standard Library is robust, we can rewrite `GridKernel` entirely in AJS.

**Example: AJS Grid Kernel**
```javascript
// GridKernel.ajs
import { Memory, Bus, Video } from 'AetherStd';

const MAP_WIDTH = 40;
const ENTITY_TABLE = 0x90000;

function moveEntity(id, dx, dy) {
   let ptr = ENTITY_TABLE + (id * 16);
   let x = Memory.read(ptr + 12);
   let y = Memory.read(ptr + 8);
   
   // ... Collision Logic ...
   
   Video.draw(x + dx, y + dy, 0xFFFFFF, 64);
}
```
