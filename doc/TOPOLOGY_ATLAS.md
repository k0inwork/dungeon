# THE ATLAS: HIERARCHY OF SPACE (v1.1)

> **Philosophy:** "The Link is the Level."
> **Architecture:** A Chain of Manifolds.

## 1. TIER 1: THE SECTOR (The Macro-Grid)
*   **Structure:** 100x100 Grid. 
*   **Role:** Exploration & Discovery.
*   **Physics:** Fatigue, Weather, Stealth.

---

## 2. TIER 2: THE NODES (The Destinations)
*   **Role:** The "Rooms" or "Hubs" of the world.
*   **Manifolds:**
    1.  **ORTHOGONAL (Standard):** Top-down, turn-based combat. (Dungeons, Towns).
    2.  **HEX (Tactical):** Large-scale skirmishes. (War Fields).

---

## 3. TIER 3: THE LINKS (The Journeys)
In the Rhizome, a connection between Node A and Node B is NOT instant. It is a **Playable Edge** acting as a transitionary Manifold.

### Type A: The Narrative Bridge (MUD Kernel)
*   **Definition:** Abstract travel handled via text parser.
*   **Use Case:** "The King's Road", "The Dense Fog", "The Border Checkpoint".
*   **Gameplay:** 
    *   No spatial grid.
    *   Series of **Skill Checks** (Survival, Stealth).
    *   **Dialogue Intersections** (e.g., "A Guard blocks the path. [Bribe] or [Attack]?").
*   **Transition:** `Grid (Town)` -> `Text (Road)` -> `Grid (Castle)`.

### Type B: The High Road (Gravity Kernel)
*   **Definition:** A linear, side-scrolling terrain representing physical verticality or traversal difficulty.
*   **Use Case:** "The Mine Shaft", "The Rooftops", "The Sewer Pipe".
*   **Structure:** Long, narrow grids (e.g., 10x200).
*   **Mechanic:** Platforming physics. Jump over gaps, avoid spikes.

### Type C: The Gauntlet (Grid Kernel)
*   **Definition:** A linear tactical corridor.
*   **Use Case:** "The Bridge of Khazad-dûm".
*   **Mechanic:** **Attrition**. Infinite spawner behind, blocked door ahead.

---

## 4. THE RHIZOME (The Unified Graph)

The World is a graph where **Nodes** and **Links** are indistinguishable to the engine; they are all just **Active Manifolds**.

### 4.1 Example Topology: The Undercity
1.  **Node A (Sewer Hub):** `Physics_Grid.wasm` (Top Down).
2.  **Link 1 (The Great Drop):** `Physics_Gravity.wasm` (Side Scroller).
3.  **Link 2 (The Dark Water):** `Physics_MUD.wasm` (Text Adventure - Swimming/Drowning checks).
4.  **Node B (The Sunken Temple):** `Physics_Hex.wasm` (Boss Fight).

---

## 5. DATA STRUCTURES

### The Manifold Definition
Every graph entry (Node OR Link) uses this schema:

```json
{
  "id": "loc_sewer_pipe_01",
  "type": "LINK", // NODE or LINK
  "kernel": "GRAVITY", // GRID, HEX, GRAVITY, MUD
  "connections": ["loc_sewer_hub", "loc_sunken_temple"],
  "config": {
    "biomes": ["SLIME", "INDUSTRIAL"],
    "length": 50,
    "gravity": 9.8
  }
}
```

---

## 6. THE MANIFOLD BRIDGE (State Translation)

When traversing from Manifold A to Manifold B, the **State Vector** is transformed.

| State Vector | Orthogonal (Grid) | Gravity (Platformer) | MUD (Text) |
| :--- | :--- | :--- | :--- |
| **Position** | `(X, Y)` Tile | `(X, Y)` Sub-pixel | `Distance` (Progress %) |
| **Action** | `AP` Accumulation | `Velocity` Vector | `Input` String |
| **Conflict** | `Attack` Range | `Jump` Hitbox | `Choice` Selection |

### 6.1 The Transition Protocol (MUD Example)
1.  **Enter:** Player steps on "Exit Tile" in Town (Grid).
2.  **Swap:** Engine loads `Physics_MUD.wasm`.
3.  **Narrate:** Console prints: *"You step onto the muddy road. The fog is thick."*
4.  **Play:** Player types `North`. Wasm calculates RNG encounter.
5.  **Result:** Wasm returns `EVENT_TRAVEL_PROGRESS(10%)`.
6.  **Exit:** Progress reaches 100%. Engine loads Destination (Grid).
