# KERNEL MANIFEST: THE PHYSICS SCRIPTS (v3.2)

> **Concept:** The Kernel is software, not hardware.
> **Format:** Forth Source Files (`.fs`).

---

## 1. THE GEOMETRY KERNELS (Spatial - State Owned by Wasm)

### CORE A: ORTHOGONAL (The Dungeon)
*   **File:** `public/kernels/grid_core.fs`
*   **Type:** `SPATIAL`
*   **API Ref:** `doc/context/SCRIPT_REF.md`
*   **Description:** Top-Down Grid physics. A*, Collision, FOV.

### CORE B: HEXAGONAL (The Battlefield)
*   **File:** `public/kernels/hex_core.fs`
*   **Type:** `SPATIAL`
*   **API Ref:** `doc/context/SCRIPT_REF.md`
*   **Description:** Hexagonal Strategy physics. Axial Coords, Flanking, ZoC.

---

## 2. THE LOGIC KERNELS (Abstract - State Owned by JS)

### CORE C: THE EXECUTOR (Generic Logic)
*   **File:** `public/kernels/logic_core.fs`
*   **Type:** `LOGIC`
*   **API Ref:** `doc/context/SCRIPT_REF_LOGIC.md`
*   **Description:** A lightweight event emitter for Card Games, Puzzles, and MUDs.
    *   **Function:** Executes AI scripts (AetherJS) and pushes Events to Queue.
    *   **Does NOT:** Manage grids, collisions, or complex internal state.
    *   **Verbs:** `SetFlag`, `Log`, `GoTo`, `AddItem`.

### CORE D: THE LEDGER (Math)
*   **File:** `public/kernels/math_core.fs`
*   **Type:** `MATH`
*   **Description:** Optimized BigInt math for Idle/Incremental games.

---

## 3. THE BRIDGE (JS <-> Forth)

WAForth allows us to bind JavaScript functions to Forth words.

| Forth Word | JS Function Binding | Usage |
| :--- | :--- | :--- |
| `JS_LOG` | `(ptr, len) => console.log(...)` | Debugging from inside Wasm. |
| `JS_ERR` | `(code) => handleError(code)` | Critical failure signal. |
