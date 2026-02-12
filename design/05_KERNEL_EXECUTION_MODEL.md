# KERNEL EXECUTION MODEL: THE BOOTSTRAP (v2.0)

> **Context:** Browser-Only Runtime (No LLVM/Rust compiler available).
> **Architecture:** Pure Forth Physics.

## 1. THE ARCHITECTURE PIVOT
We cannot ship pre-compiled `sim_grid.wasm` binaries containing C++ physics because we cannot compile them in the user's browser.
Instead, we use the **Standard WAForth Binary** as a generic "Blank Slate" and bootstrap the physics engine into it using Forth Source Code.

## 2. THE BOOT SEQUENCE

### Step 1: The Virtual Machine (Hardware)
React loads the standard `waforth` npm package.
*   **Binary:** `waforth.wasm` (Generic Forth Interpreter).
*   **State:** Empty Dictionary. Core Arithmetic only.

### Step 2: The Kernel Injection (Operating System)
React loads the static text file `kernels/grid_physics.fs` and feeds it to the interpreter.
*   **Content:** Defines the Memory Layout, the A* Pathfinding, the Collision Logic, and the Event System.
*   **Result:** The VM now "knows" how to be a Roguelike Engine. It has words like `MOVE_ENTITY`, `CHECK_COLLISION`, `PROCESS_TURN`.

### Step 3: The Content Injection (Software)
React transpiles the AI-generated JSON into a dynamic text string `scripts.fs` and feeds it.
*   **Content:** Defines specific Spells (`: CAST_FIREBALL ... ;`) and Items.
*   **Result:** The VM now has gameplay content.

---

## 3. PERFORMANCE IMPLICATIONS
*   **Pros:** Extreme flexibility. We can patch the Physics Engine in real-time without reloading the page.
*   **Cons:** Forth is slower than optimized C++/Rust Wasm.
*   **Mitigation:** WAForth includes a JIT (Just-In-Time) compiler that compiles Forth words to Wasm instructions on the fly. This is significantly faster than a JS interpreter and sufficient for 2D Grid logic.

---

## 4. THE FILE STRUCTURE

We are no longer building `.wasm` files. We are building `.fs` (Forth Script) files.

| Role | Old Filename (Binary) | New Filename (Source) |
| :--- | :--- | :--- |
| **Dungeon Engine** | `sim_grid.wasm` | `kernels/grid_core.fs` |
| **War Engine** | `sim_hex.wasm` | `kernels/hex_core.fs` |
| **API Bridge** | (Internal C) | `kernels/std_bridge.fs` |

## 5. EXAMPLE KERNEL CODE (grid_core.fs)

```forth
( The Physics Engine in Pure Forth )

\ Define Memory Offsets
0x00400 CONSTANT INPUT_QUEUE
0x10400 CONSTANT OUTPUT_QUEUE

: GET_DISTANCE ( x1 y1 x2 y2 -- dist )
  ROT - ABS -ROT - ABS + 
;

: MOVE_ENTITY ( id dx dy -- )
   \ ... Collision logic written in Forth ...
   \ ... Update Memory ...
;
```
