# VISUAL CORTEX SPECIFICATION (v2.0)

> **Status:** APPROVED DESIGN
> **Supersedes:** `doc/VISUAL_CORTEX.md`
> **Role:** The "Right Brain" of the simulation.

## 1. CELLULAR AUTOMATA (The Living Grid)
Runs at the end of every Turn.

### 1.1 The Rule Format
Automata are defined by **Bytecode Rules** stored in `GRID_TILES`.
*   **Rule:** `(NeighborCount > X) AND (NeighborType == Y) => BECOME Z`

### 1.2 The Implementation (Double Buffer)
To prevent cascading updates (e.g., one fire tile instantly igniting the whole map in 1 frame), we use a standard CA strategy:
1.  **Read:** `GRID_TILES` (Current State).
2.  **Write:** `GRID_TEMP` (Next State).
3.  **Swap:** `memcpy(GRID_TILES, GRID_TEMP)`.

---

## 2. DYNAMIC LIGHTING (The Luminary)
Runs every Frame (or every N frames for performance).

### 2.1 Algorithm: Recursive Shadowcasting
We use a specialized Shadowcasting algorithm optimized for Wasm.
*   **Input:** List of LightSources `(x, y, radius, color)`.
*   **Map:** `GRID_TILES` (BlocksLight flag).
*   **Output:** `LIGHT_MAP` (ARGB Array).

### 2.2 Color Mixing
We use **Additive Blending** with saturation clamping.
`Pixel = Ambient + LightA + LightB`

---

## 3. PARTICLE PHYSICS
Runs every Frame.

### 3.1 Supported Physics Modes
Defined as Integer Constants in the Kernel.

1.  **MODE_BALLISTIC (0):**
    *   Applies Gravity (`vy += 0.1`).
    *   Checks Collision with `GRID_TILES`.
    *   Bounces (`vy *= -0.5`).
2.  **MODE_GAS (1):**
    *   Negative Gravity (`vy -= 0.05`).
    *   Brownian Motion (`vx += rand()`).
3.  **MODE_LIQUID (2):**
    *   Applies Gravity.
    *   If Collides: Stop Y, Spread X (Viscosity).
