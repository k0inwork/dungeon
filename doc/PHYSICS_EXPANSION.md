# PHYSICS EXPANSION: MATTER, MASS & HEIGHT (v1.3)

> **Context:** v1.3 Update.
> **Goal:** Expanding interaction complexity beyond "Damage" to include Stacking, Layers, and Volume.

---

## 1. THE SHAPER PROTOCOL (Terrain Mutation)

To model "Minecraft-lite" or "Zelda-lite" interactions, scripts must be able to transmute the grid.

### 1.1 The Harvest Cycle
Instead of simply "destroying" a wall, we **Transmute and Yield**.

*   **Logic:** `Tree` (Terrain) -> `Cut` (Action) -> `Stump` (Terrain) + `Log` (Artifact).
*   **Wasm Word:** `TRANSMUTE ( x y new_tile_id yield_entity_id -- )`

### 1.2 Example Script: "Lumberjack Axe"
```javascript
// Target is a Tile, not an Entity
if (GetTileType(TargetX, TargetY) == TILE_TREE) {
    VFX(CHOP_WOOD);
    // Change Tree to Stump, Spawn Log Artifact
    Transmute(TargetX, TargetY, TILE_STUMP, ARTIFACT_LOG); 
}
```

---

## 2. THE CARRIER PROTOCOL (Mass & Equipment)

The Entity Memory includes a `CARRYING` slot. This is the **Active Hand**.

### 2.1 The "Carrying" Pointer
*   **Memory Field:** `Entity.CARRYING` (i32).
*   **Value:** `ID` of the artifact being held. `0` if empty.

### 2.2 Mass Physics
The "Weight" of an artifact is not just a number; it is a physics modifier.
*   **Formula:** `EffectiveSpeed = BaseSpeed - (Artifact.Weight / StrengthFactor)`.
*   **Throwing:** `MaxThrowDistance = StrengthFactor / Artifact.Weight`.
    *   *Implication:* You can throw a Potion (Weight 1) across the room. You can only drop a Gold Idol (Weight 50) at your feet.

### 2.3 Interaction verbs
1.  **PICKUP:** Source moves onto `ARTIFACT_SWORD`. Script calls `Take(Target)`.
    *   `Target` is removed from the Grid (set coordinates to -1, -1).
    *   `Source.CARRYING` becomes `Target.ID`.
    *   `Source` gains `Artifact.onEquip` buffs.
2.  **USE:** Source presses "Item Button".
    *   Executes `Artifact.onUse` script.
3.  **DROP:** Source calls `Drop()`.
    *   `Source` loses `Artifact.onEquip` buffs.
    *   `HeldID` gets `Source.X, Source.Y`.
    *   `Source.CARRYING` becomes `0`.

---

## 3. THE ELEVATION LAYER (Verticality)

Crucial for Hex Strategy and Platformers.

### 3.1 Memory Field
*   **Memory Field:** `Entity.ELEVATION` (i32).
*   **Default:** 0 (Ground Level).
*   **Terrain:** Tiles now have a defined `Z-Height`.

### 3.2 The High Ground Rules (Hex Kernel)
The `HexPhysics.wasm` module applies these modifiers:

1.  **Melee:** Cannot attack if `abs(Target.Z - Source.Z) > 1`.
2.  **Ranged:**
    *   If `Source.Z > Target.Z`: **+20% Accuracy/Damage** (High Ground).
    *   If `Source.Z < Target.Z`: **-20% Accuracy/Damage** (Uphill Battle).
3.  **Movement:**
    *   Step Up (`+1 Z`): Cost `2.0 AP`.
    *   Step Down (`-1 Z`): Cost `1.0 AP`.
    *   Cliff (`> +1 Z`): **Blocked** (unless Flying).
    *   Drop (`> -1 Z`): **Falling Damage** (10 HP per Z).

---

## 4. THE STACKING PROTOCOL (Collision Layers)

To support MUD-style rooms, Item Stacks, and Swarms, we abandon the "One Entity Per Tile" rule in favor of **Manifold Capacity**.

### 4.1 The Layer Bitmask
Every Entity has a `COLLISION_LAYER` (i32) property in Hot Memory.
*   **Bit 0 (1):** `TERRAIN` (Walls, Doors)
*   **Bit 1 (2):** `FLOOR` (Items, Traps, Runes)
*   **Bit 2 (4):** `ACTOR` (PC, NPC, Monsters)
*   **Bit 3 (8):** `AIR` (Flying Units, Projectiles)

### 4.2 Manifold-Dependent Logic
The **Physics Kernel** determines the stacking rules via a `CapacityConstraint`.

| Kernel | Constraint Logic | Example |
| :--- | :--- | :--- |
| **PHYSICAL (Grid/Hex)** | `Sum(Volume) <= 1.0` | 1 Human (Vol 1.0) OR 5 Rats (Vol 0.2). |
| **ABSTRACT (MUD/Text)** | `No Limit` | A "Tavern" node containing 50 NPCs. |
| **FLUID (Factory)** | `Max(ITEM) = 1` | 1 Item per Belt segment. |

### 4.3 The Volume Check
Entities have a `SIZE` stat (0.0 to 1.0).
*   **Collision:** Moving into a tile checks: `(CurrentVolume + IncomingVolume) <= MaxVolume`.
*   **Failure:** If check fails, `CollisionEvent` is triggered (Block or Push).
