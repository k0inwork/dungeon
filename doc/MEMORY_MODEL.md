# THE ARENA: MEMORY MODEL (v2.2)

> **Context:** v2.1 Stacking Support.
> **Philosophy:** "WASM is the Scratchpad. O(1) Lookup is King."

---

## 1. THE MASTER STATE (JavaScript)
The "Source of Truth" lives entirely in the JavaScript Heap.

```typescript
interface MasterState {
  // Global World
  worldSeed: string;
  turnCount: number;
  
  // The Roster
  entities: Record<number, Entity>; // All entities in the current level
  
  // The Map
  terrain: Tile[][]; // The 2D Grid
  
  // The "Focus"
  activeZone: {
    origin: { x: number, y: number };
    dimensions: { w: number, h: number };
  }
}
```

## 2. THE BATTLE SNAPSHOT (Wasm Injection)
When a turn begins, JS serializes relevant data into a compact binary format for WASM.

### 2.1 The Header (Global Context)
Stored at `0x00`.
*   `TURN_NUMBER` (i32)
*   `RNG_SEED` (i32)
*   `ENTITY_COUNT` (i32)
*   `MAP_WIDTH` (i32)
*   `MAP_HEIGHT` (i32)

### 2.2 The Terrain Buffer (The Grid)
Stored at `0x100` (Arbitrary Offset).
*   A flat array of `i32` representing the **Local Grid** (e.g., the 20x20 room the player is in).
*   We do not load the whole world. We load the "Room".

### 2.3 The Entity Buffer (The Gladiators)
Stored at `0x2000`.
JS filters `MasterState.entities` to find only those **inside the Active Zone**.
It packs them into the `HotStruct` format (defined in previous docs) and writes them sequentially.

---

## 3. THE SPATIAL INDEX (Wasm-Only)

Since multiple entities can now share `(X, Y)`, we cannot just store `EntityID` in the Terrain Buffer.
To avoid O(N) iteration every time we check a tile, WASM builds a **Transient Spatial Hash** at the start of every `RUN_TURN`.

### 3.1 The Linked List Strategy
We use two arrays in Linear Memory to create a bucketed linked list.

1.  **HEAD_POINTERS [`MapSize`]:**
    *   Maps `TileIndex (y*w + x)` to the `Index` of the *first* entity on that tile.
    *   Value `-1` means Empty.

2.  **NEXT_ENTITY [`MaxEntities`]:**
    *   Maps `EntityIndex` to the `Index` of the *next* entity on the same tile.
    *   Value `-1` means End of Stack.

### 3.2 Query Algorithm (O(k) where k = stack size)
```forth
: GET_ENTITIES_AT ( x y -- )
  calc_tile_index -> idx
  HEAD_POINTERS idx cells + @ -> ent_idx
  
  BEGIN ent_idx -1 <> WHILE
    ent_idx PROCESS_ENTITY \ Do something with it
    NEXT_ENTITY ent_idx cells + @ -> ent_idx \ Move to next in stack
  REPEAT
;
```

---

## 4. THE "DIFF" CYCLE

### Step 1: Snapshot Injection
JS writes the Snapshot into Wasm Memory.

### Step 2: Indexing (New)
WASM iterates the Entity Buffer once (O(N)) to populate `HEAD_POINTERS` and `NEXT_ENTITY`.

### Step 3: Computation (The Black Box)
WASM runs. It modifies the **WASM Copy** of the entities.
*   **Move Logic:** If Entity moves from A to B, WASM updates the `HEAD_POINTERS` and `NEXT_ENTITY` lists locally to keep physics accurate during the turn (e.g., unit collision).

### Step 4: Diffing (Optimization)
Instead of re-reading *everything*, WASM populates a "Dirty List" or "Event Queue".
*   "Entity 5 moved."
*   "Entity 2 took damage."

### Step 5: Synchronization
JS reads the Event Queue and applies changes to `MasterState`.

---

## 5. PERSISTENCE IMPLICATIONS
Since WASM memory is transient:
*   We do **not** need to persist WASM memory to Firebase.
*   We can `WebAssembly.instantiate()` a new module for every distinct game mode (e.g., swapping `StandardPhysics.wasm` for `GravityPhysics.wasm`) instantly, because there is no persistent state to migrate. We just inject the snapshot into the new module.
