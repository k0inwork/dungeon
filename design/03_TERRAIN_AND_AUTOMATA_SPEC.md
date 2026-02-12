# REACTIVE TERRAIN SPECIFICATION (v3.4)

> **Status:** APPROVED DESIGN
> **Role:** The "Physics Engine" of the Environment.
> **Visual:** ASCII Grid.

## 1. PHILOSOPHY
Tiles are **Reactive**. They wait for an Entity to touch them or hit them.
**NO SPREADING.** To maintain stability and "Terminal" aesthetics, environmental hazards do not replicate.

## 2. THE STATIC HAZARD PROTOCOL

### 2.1 The "Living Flame" (Static)
Instead of a complex simulation, "Fire" is simply a hazardous entity.

**AetherJS Script (`ENTITY_STATIC_FIRE.script_main`):**
```javascript
// Runs every turn (or tick)
function onTurn() {
    // 1. Damage anyone standing on us
    let victim = GetEntityAt(Source.X, Source.Y);
    if (victim) {
        Damage(victim, 10, TYPE_THERMAL);
    }
    
    // 2. Emit visual smoke particles
    EmitParticle(Source.X, Source.Y, VFX_SMOKE);
    
    // 3. (Optional) Burn out after N turns
    // If we wanted it to disappear, we'd track age. 
    // For now, it burns forever.
}
```

### 2.2 Transmutation (Single Tile)
We still allow interactions to change a *single* tile.
*   **Action:** Fireball hits Ice Wall (`#`).
*   **Result:** Wall becomes Water (`~`).
*   **Constraint:** The water does *not* flow. It stays in that cell.

---

## 3. TERRAIN SCRIPTING API

Scripts attached to Tiles (Reactive) operate with:
*   `Source`: The Entity triggering the event (Walker / Attacker).
*   `Target`: Null (or the Tile itself).

**Example: ASCII Land Mine**
```javascript
function onWalk() {
    TriggerVFX(Source.X, Source.Y, VFX_EXPLOSION); // Spawns '*' particles
    Damage(Source, 100, TYPE_KINETIC);
    SetTile(Source.X, Source.Y, TILE_FLOOR); // Becomes '.'
}
```
