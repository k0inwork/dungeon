# AETHELGARD: TOTAL PROGRAMMING REFERENCE (v1.5)

> **Scope:** Full Stack (AI Scripting -> Transpiler -> Wasm Kernel).
> **Audience:** System Architects & AI Generators.

---

## PART 1: THE HIGH-LEVEL API (AetherJS/AetherPy Scripting)

### 1.1 The Context Objects
Global objects injected into every script execution.

| Object | Property | Type | Description |
| :--- | :--- | :--- | :--- |
| **Source** | `.HP` | `int` | Current Hit Points. |
| | `.X`, `.Y` | `int` | Grid coordinates. |
| **Target** | `.HP` | `int` | Defender's HP. |
| **Material** | `.Hardness` | `int` | Durability of terrain. |

### 1.2 The Verb Dictionary (Action API)

#### Kinetic Actions (Combat)
*   `Damage(Target, amount, type_const)`: Queues damage.
*   `Push(Target, distance)`: Kinetic force.
*   `Teleport(Entity, x, y)`: Instant displacement.

#### Visual Cortex Actions (Particles)
*   `Emit(count, color_hex, physics_mode)`
    *   *Effect:* Spawns debris particles at Source location.
    *   *Modes:* `PHYSICS_BOUNCE`, `PHYSICS_FLOAT`, `PHYSICS_LIQUID`.
*   `Flash(color_hex, duration)`
    *   *Effect:* Tints the entity/tile for N frames.
*   `Shake(intensity)`
    *   *Effect:* Offsets camera render (JS side) via event.

#### Luminary Actions (Lighting)
*   `AttachLight(radius, color_hex, flicker_mode)`
    *   *Effect:* Attaches a light source to the entity.
    *   *Modes:* `FLICKER_NONE`, `FLICKER_FIRE`, `FLICKER_PULSE`.

#### Environmental Actions (Reactive)
*   `SetTile(x, y, tile_id)`
    *   *Effect:* Transmutes the grid at X, Y.
*   `Spawn(entity_id, x, y)`
    *   *Effect:* Creates a new Entity (Mob, or Environmental Agent like Fire).
*   `CountNeighbors(tile_type)`
    *   *Returns:* Integer (0-8).

---

## PART 2: THE TRANSPILER SPECIFICATION

### 2.1 Type Constants

```javascript
const CONSTANTS = {
  // ... existing constants ...
  
  // Visual Physics
  "PHYSICS_BOUNCE": 10,
  "PHYSICS_FLOAT": 11,
  "PHYSICS_LIQUID": 12,
  
  // Lighting Modes
  "FLICKER_NONE": 0,
  "FLICKER_FIRE": 1,
  "FLICKER_PULSE": 2
};
```

---

## PART 3: THE LOW-LEVEL KERNEL (Forth / Wasm)

### 3.1 Memory Layout (Linear RAM)

**Zone D: Visual Buffers (0x8000 - Fixed)**
*   `PARTICLE_COUNT` (i32)
*   `PARTICLES`: Array[2048] of `struct { x, y, vx, vy, color, life }`.

**Zone E: Light Buffer (0xA000 - Fixed)**
*   `LIGHT_MAP`: Array[MapWidth * MapHeight] of `u32` (ARGB).

### 3.2 Core Words (Visuals)

*   `EMIT_PARTICLE ( color mode count -- )`: Loops `count` times, finding dead slots in `PARTICLES`.
*   `UPDATE_LIGHTING ( -- )`: Clears Light Map, iterates sources, raycasts to fill map.

---

## PART 4: THE HANDOFF PROTOCOL

1.  **AetherJS Script:** `AttachLight(5, 0xFF0000, FLICKER_FIRE)`
2.  **Transpiler:** `5 0xFF0000 1 ATTACH_LIGHT`
3.  **Wasm:** Updates Entity Metadata.
4.  **Host JS Loop:** 
    *   `const lightRAM = new Uint32Array(wasm.memory.buffer, 0xA000, 60*30);`
    *   `Canvas.drawLightOverlay(lightRAM);`
