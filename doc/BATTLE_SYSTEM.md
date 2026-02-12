# THE KINETIC PRISM: INTERACTION SYSTEM ARCHITECTURE (v1.7)

> **Philosophy:** "Not all conflict is combat. Trade is a battle of value. Stealth is a battle of information."
> **Architecture:** Hybrid. JS manages the flow; Forth manages the physics; The Event Bus manages the consequences.

---

## 1. THE FIVE FUNDAMENTAL VECTORS (Physics)

We have expanded the physics model to support Stealth and Economy.

*   **Vector A: REAL DAMAGE (HP)** - Subtraction from Existence.
*   **Vector B: TEMPORAL DAMAGE (AP)** - Subtraction from Time (Stun/Haste).
*   **Vector C: SPATIAL DAMAGE (XY)** - Mutation of Position. **Context Dependent.**
*   **Vector D: RESOURCE DAMAGE (RES)** - Mutation of Assets (Theft/Trade/Crafting).
*   **Vector E: INFORMATION DAMAGE (VIS)** - Mutation of Awareness (Stealth/Detection).

---

## 2. SPATIAL CONTEXTS (Vector C Details)

The logic of `Push` and `Teleport` changes based on the Active Manifold.

### 2.1 Context: ORTHOGONAL (The Grid)
*   **Push(1):** Moves Target 1 tile away along the 4-way axis relative to Source.
*   **Cleave:** Targets 3 tiles in front of Source (Forward, Forward-Left, Forward-Right).

### 2.2 Context: HEXAGONAL (The Honeycomb)
*   **Push(1):** Moves Target 1 hex away along the 6-way axis.
*   **Cleave:** Targets the 2 adjacent hexes in the Front Arc.
*   **Flanking:** Damage scripts automatically apply multipliers based on `Target.FACING`.
    *   *Front:* 1.0x
    *   *Side:* 1.25x
    *   *Rear:* 1.5x

---

## 3. THE EVENT BUS (The Consequence Engine)

While Vectors handle the *math* of combat, the **Event Bus** handles the *drama* and *environment*.

### 3.1 Environmental Destruction (`EVENT_TERRAIN`)
Scripts can modify the battlefield itself.
*   **Use Case:** `Fireball` misses the target and hits a `WALL`.
*   **Logic:** The script checks `IF TARGET_TYPE == WALL`.
*   **Action:** Queues `TERRAIN(0, 0, TILE_RUBBLE)`.

### 3.2 Summoning & Necromancy (`EVENT_SPAWN`)
*   **Use Case:** `Raise Dead`.
*   **Action:** Queues `SPAWN(SKELETON_ID, 1, 0)`.

### 3.3 Visual & Auditory Feedback (`EVENT_VFX`)
*   **Use Case:** A "Vampiric Drain" spell.
*   **Action:** Queues `VFX(EFFECT_BEAM_RED, SOURCE, TARGET)`.

### 3.4 Narrative Interrupts (`EVENT_SHOUT`)
*   **Use Case:** A Boss reaches 50% HP.
*   **Script:** `IF HP < MAX_HP / 2 THEN SHOUT("You cannot defeat me!")`.

### 3.5 Transaction Events (`EVENT_TRADE`)
*   **Use Case:** Merchant Script.
*   **Script:** `IF Source.Gold >= 100 THEN Pay(100); GiveItem(POTION);`.
*   **Wasm:** Updates `RES_A` (Gold) in memory. Queues `EVENT_GIVE_ITEM` for JS to handle inventory UI.

---

## 4. THE SENSORIUM (Stealth & Perception)

Entities now possess `VISIBILITY` (0-100) and `NOISE` (0-100) properties in Memory.

### 4.1 The Detection Check
Before a script executes `Damage`, it should often check `CanSee`.

```javascript
// Sniper Rifle Script
// Logic: High damage, but requires line of sight and low noise.
if (CanSee(Target)) {
    Damage(100, TYPE_KINETIC);
    MakeNoise(100); // Reveals position
} else {
    Log("No clear shot.");
}
```

---

## 5. FORTH IMPLEMENTATION EXAMPLES

### 5.1 Queuing a Terrain Change
```forth
\ Stack: relative_x relative_y new_tile_id --
: MODIFY_TERRAIN
  EVENT_PTR @ -> ptr
  TYPE_TERRAIN ptr !
  ptr 4 + ! \ Store new_tile_id
  ptr 8 + ! \ Store rel_y
  ptr 12 + ! \ Store rel_x
  ptr 16 + EVENT_PTR !
;
```

---

## 6. THE INTERRUPT PROTOCOL (Logic Gates)

How we handle "Riddles" and "Passwords" without blocking the Physics Engine.

### 6.1 The Problem
Physics must run at 60fps (or at least fast). Waiting for user input (`AwaitPhrase`) freezes the engine.

### 6.2 The Solution: The Interrupt Event
Instead of waiting, the script **Halts and Exits**.

1.  **Script:** `RequireInput(HASH_PASSWORD, "Speak Friend and Enter");`
2.  **Wasm:** 
    *   Writes `EVENT_INTERRUPT` to Event Queue.
    *   Writes `Prompt` and `Hash` to Event Data.
    *   **Terminates Execution** of the current turn immediately.
3.  **JavaScript:**
    *   Reads `EVENT_INTERRUPT`.
    *   Pauses Simulation.
    *   Displays UI Modal to Player.
4.  **Resolution:**
    *   Player enters "Mellon".
    *   JS calls `ResumeTurn(Input="Mellon")`.
    *   Wasm re-runs logic with injected input.
