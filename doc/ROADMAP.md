# AETHELGARD ROADMAP & STATUS (v0.6)

## CURRENT STATUS
*   **Kernel Core:** Stable. Compiles successfully. Strings removed to ensure interpreter compatibility.
*   **Rendering:** 60FPS Shared Memory Buffer. Works.
*   **Player Movement:** Functional. Collision detection active.
*   **Map Generation:** Functional.

## DISCREPANCIES (Why are NPCs not moving?)
Currently, `LOAD_TILE` draws entities to the screen and marks their collision, but it does not register them in an iterable **Entity Table** inside the Wasm memory.

Because the Kernel doesn't know "who" is at "x,y", it cannot iterate through them to run AI scripts.

## PLAN: ENABLE AI & COMBAT

### Phase 1: The Roster (Memory)
1.  Define `ENTITY_TABLE` (Array of Structs: `{ id, x, y, hp, type }`).
2.  Update `LOAD_TILE` to populate this table when loading an entity char.

### Phase 2: The Pulse (Turn Loop)
1.  Create `RUN_TURN` word in Forth.
2.  Loop through `ENTITY_TABLE`.
3.  If `HP > 0`, call `RUN_AI`.

### Phase 3: The Brain (AI)
1.  Implement `RUN_AI ( ent_ptr -- )`.
2.  Simple logic: `RNG 4 %` (Random Direction).
3.  Call `ATTEMPT_MOVE` for the enemy.
