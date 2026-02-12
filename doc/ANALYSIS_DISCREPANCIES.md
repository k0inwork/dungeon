# SYSTEM ANALYSIS: DISCREPANCIES & ARCHITECTURAL DEBT (v2.3)

> **Status:** Correction Implemented
> **Focus:** Robust Kernel Loading & Diagnostics.

---

## 1. THE MONOLITHIC LOADING FAILURE
**Observation:**
Loading the entire `GRID_KERNEL` string (150+ lines of Forth) in a single `mainProc.run()` call makes debugging nearly impossible. 
When the interpreter encounters a syntax error on Line 40 (e.g., inside `ATTEMPT_MOVE`), it aborts compilation silently or with a vague error. 
Because execution stops, subsequent definitions like `PROCESS_INPUT` (Line 140) are never defined.
The User sees "undefined word: PROCESS_INPUT" and assumes the error is there, but the root cause is 100 lines earlier.

**Correction:**
We have modularized `GridKernel.ts` into `GRID_KERNEL_BLOCKS`.
`index.tsx` now loads these blocks sequentially:
1.  Header/Memory
2.  Helpers (Check `TWO_OVER`)
3.  Graphics
4.  Game API (Check `LOAD_TILE`)
5.  Movement Logic (Check `ATTEMPT_MOVE`)
6.  Input Loop

If Block 5 fails, the app now explicitly throws "ATTEMPT_MOVE compilation failed", allowing us to pinpoint the issue immediately.

## 2. THE ACTIVATION AMBIGUITY
**Observation:** 
Platformers are Real-Time (Tick-Based), Roguelikes are Turn-Based.
**Correction:** 
We split the engine into two distinct runtimes:
1.  **The Loop (JS):** `requestAnimationFrame`. Handles Platformers.
2.  **The Pulse (Wasm):** `async runTurn()`. Handles Roguelikes/Hex.

## 3. COMPILATION FAILURE (Undefined Words)
**Observation:**
Users reported `undefined word: PROCESS_INPUT`. This happens when the Forth Kernel encounters a syntax error (e.g., using `EXIT` improperly or missing a dependency like `PICK`) mid-file, causing it to abort compilation before reaching the final words.
**Correction:**
1.  **Explicit Definitions:** We now define primitives like `>=` and `TWO_OVER` manually in `GridKernel.ts` rather than relying on standard libraries that might vary between WAForth versions.
2.  **Simplified Control Flow:** `ATTEMPT_MOVE` was refactored to check bounds and exit early using cleaner logic stack management.
3.  **Integrity Check:** `index.tsx` now runs a `isWordDefined` check on 8 critical words immediately after loading the kernel. If any are missing, it halts and reports exactly which one failed.

## 4. NEXT STEPS
1.  Verify Map Generation injects valid ASCII codes.
2.  Optimize `TerminalCanvas` for 4k resolution.
