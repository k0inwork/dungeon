# ENTITY SCHEDULING & ACTIVATION SPECIFICATION (v1.1)

> **Requirement:** "Platformers: Active = Visible. Others: Different."
> **Architecture:** Hybrid (JS Loop vs Wasm Pulse).

## 1. REAL-TIME SCHEDULER (Platformer / JS)

**Runtime:** `PlatformerPhysics.ts`
**Cycle:** `requestAnimationFrame` (16.6ms)

### 1.1 The Viewport Check
We Iterate the `EntityList` (JavaScript Array).
```typescript
const BUFFER = 100; // Pixels
function gameLoop(dt) {
  for (const entity of levelEntities) {
    // 1. Culling
    if (entity.x > cam.x - BUFFER && entity.x < cam.x + cam.width + BUFFER) {
      entity.isActive = true;
      
      // 2. Physics
      updatePhysics(entity, dt);
      
      // 3. Simple AI (Patrol)
      if (entity.aiType === 'PATROL') updatePatrol(entity);
    } else {
      entity.isActive = false;
    }
  }
}
```
**Optimization:** For lists > 1000 entities, use a QuadTree. For < 100, simple Array iteration is faster.

---

## 2. TURN-BASED SCHEDULER (Roguelike / Wasm)

**Runtime:** `sim_grid.wasm`
**Cycle:** `Event Driven` (Wait for Input -> Process Batch).

### 2.1 The Room Check
Entities are indexed by `RoomID` in Wasm Memory.

```forth
: RUN_TURN
  \ 1. Get Player Room
  PLAYER_PTR @ .room_id @ -> current_room
  
  \ 2. Iterate ONLY entities in this room
  \ (Using a Linked List approach described in Memory Model)
  current_room GET_FIRST_ENTITY -> ent_idx
  
  BEGIN ent_idx -1 <> WHILE
    ent_idx PROCESS_ENTITY
    ent_idx GET_NEXT_ENTITY -> ent_idx
  REPEAT
  
  \ 3. Background Simulation (Optional)
  \ E.g., Move specific "Hunter" units that are tracking player
  RUN_GLOBAL_ENTITIES
;
```

---

## 3. PERSISTENCE

When switching between Modes (e.g., Falling down a hole in Roguelike -> Landing in Platformer):
1.  **Serialize:** Wasm dumps `Player.HP`, `Player.Inventory` to JS.
2.  **Transition:** JS loads `PlatformerEngine`.
3.  **Inject:** JS applies `Player.HP` to the Platformer Player Object.
