# GAME GENRE REGISTRY (v2.0)

> **Philosophy:** "JavaScript holds the Cards. Wasm plays them."
> **Architecture:** Logic Offloading.

## 1. SPATIAL GENRES (Physics Simulation)
*State held primarily in Wasm (high frequency position updates).*

### A. THE ROGUELIKE (Dungeon Crawler)
*   **Kernel:** `kernels/grid_core.fs`
*   **Focus:** Collision, Line of Sight, Pathfinding.
*   **Wasm Role:** Full World Simulation.

### B. THE WARGAME (Tactical Strategy)
*   **Kernel:** `kernels/hex_core.fs`
*   **Focus:** Orientation, Flanking, Zone of Control.
*   **Wasm Role:** Full World Simulation.

---

## 2. ABSTRACT GENRES (Logic Simulation)
*State held primarily in JavaScript. Wasm used for secure Script Execution.*

### C. THE DUELIST (Deckbuilder)
*   **Kernel:** `kernels/logic_core.fs` (Shared Generic Kernel)
*   **Structure:** Round-Based Resource Economy.
*   **JS Role:** Manages `Deck`, `Hand`, `Discard`, `EnemyIntent`.
*   **Wasm Role:** **Effect Executor**.
    *   Input: `ExecuteCard(ScriptID, TargetID)`.
    *   Logic: Runs the AI-generated script (e.g., "If Target has Poison, deal double damage").
    *   Output: `EVT_DAMAGE`, `EVT_APPLY_STATUS`.

### D. THE TYCOON (Idle / Simulation)
*   **Kernel:** `kernels/math_core.fs`
*   **Structure:** Continuous Time Tick.
*   **JS Role:** UI Rendering, Save/Load.
*   **Wasm Role:** **Formula Engine**.
    *   Input: `CurrentCash`, `BuildingCounts`, `UpgradesActive`.
    *   Logic: Calculates complex compound interest and synergy bonuses (AI generated math).
    *   Output: `NewCashDelta`.

### E. THE DETECTIVE (Puzzle / IF)
*   **Kernel:** `kernels/logic_core.fs`
*   **Structure:** State Machine.
*   **JS Role:** Inventory UI, Dialogue Text Display.
*   **Wasm Role:** **State Validator**.
    *   Input: `UseItem(ItemID, TargetID)`.
    *   Logic: Checks global flags (`IS_DOOR_LOCKED`, `HAS_KEY`).
    *   Output: `EVT_UNLOCK`, `EVT_TRIGGER_DIALOGUE(ID)`.

---

## 3. REAL-TIME STRATEGY (The Swarm)
*   **Kernel:** `kernels/boid_core.fs` (Future)
*   **Structure:** Massive Entity Count (1000+).
*   **Wasm Role:** Boid Flocking Physics (Separation, Alignment, Cohesion).
*   **Note:** This returns to a Spatial model where Wasm owns the state due to performance needs.
