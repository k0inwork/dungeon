# PROPOSAL: INSTANT PLAYABILITY & MOCKING (v1.0)

> **Goal:** Enable sub-second iteration loops and basic character movement.

## 1. THE MOCK STRATEGY
Development velocity is hindered by the 15s+ latency of LLM calls.
**Implementation:**
1.  **Golden Sample:** A static `WorldData` object representing a "Cyberpunk Sewer" level.
2.  **Bypass:** `Shift + Click` on the Generate button triggers `generatorService.getMockWorld()`.

## 2. THE PHYSICS PATCH (GridKernel)
The current kernel logs input but affects no change.
**Implementation:**
1.  **Memory Allocation:**
    *   `0x30000`: **COLLISION_MAP** (1 byte per tile).
    *   `0x30400`: **PLAYER_STATE** (X, Y).
2.  **Logic Update:**
    *   `LOAD_TILE`: Now writes to `VRAM` (Color/Char) AND `COLLISION_MAP` (Passability).
    *   `PROCESS_INPUT`:
        *   Calculates Target X,Y.
        *   Checks `COLLISION_MAP[Target]`.
        *   If `0` (Passable): Updates Player X,Y and Redraws VRAM.
        *   If `1` (Wall): Plays generic "Bump" sound (Visual shake).
        *   If `2` (Gate): Triggers `EVT_GATEWAY`.

## 3. NEXT STEPS
*   Implement Entity Collision (Entities are currently just pixels).
*   Implement Turn Counter.
