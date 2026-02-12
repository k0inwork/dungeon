# GAP ANALYSIS & RISK ASSESSMENT (v3.5)

> **Status:** Critical Review
> **Architecture:** v3.3 (Double-Queue, Reactive Terrain, Entity-Environment)

## 1. THE BRIDGE GAP (Infrastructure)

**The Correction:**
Previous analysis suggested a complex Object-Relational Mapper (ORM). **This is incorrect.**
We rely on the **Double-Queue** pattern. We do not map objects in real-time.

**Actual Requirement:**
1.  **Queue Drivers:** Simple `DataView` wrappers to write commands (`Int32Array`) to `0x00400` (Inbox).
2.  **Snapshot Injection (Bulk Load):** A one-time bulk copy script that takes the Level JSON and writes it to the `ENTITY_TABLE` in Wasm memory *before* the loop starts.
3.  **Risk:** The only risk is **Byte Offset Mismatch**. If Typescript thinks `Entity.X` is at byte 4, but Wasm thinks it's at byte 8, the world breaks.
    *   *Mitigation:* A shared `constants.ts` / `constants.h` file defining memory offsets.

---

## 2. THE TRANSPILER GAP (Variable Scoping)

**The Correction:**
We should not rely on the Transpiler to magically "mangle" variable names (e.g., converting `x` to `CTX_104_X`). This is error-prone.

**Actual Requirement:**
1.  **AI Responsibility:** The System Prompt must explicitly instruct the AI to use specific prefixes for variables based on the Context ID.
    *   *Prompt:* "You are generating a script for context 'SKILL_FIREBALL'. You MUST prefix all variables with 'fireball_' (e.g., `let fireball_radius = 10`)."
2.  **Transpiler Validation:** The Transpiler simply checks if the variables follow the convention. If they don't, it throws an error. It does *not* try to rewrite them.

---

## 3. THE CRUCIBLE GAP (Validation Workflow)

**The Correction:**
We will **NOT** implement an infinite or 3-try retry loop with the AI. It consumes tokens and often fails anyway.

**Actual Requirement:**
1.  **One-Shot Validation:** The AI generates the code. We run the Transpiler check *once*.
2.  **The "Red Flag" Protocol:**
    *   If valid: Compile and ready.
    *   If invalid: Flag the Entity/Script as `STATUS: BROKEN`.
3.  **Architect Intervention:**
    *   The Simulation **cannot start** while `BROKEN` flags exist.
    *   The User is presented with the "Architect View" highlighting the broken scripts.
    *   The User manually fixes the syntax error or variable name in the integrated IDE.

---

## 4. THE ASSET GAP (Presentation)

**The Problem:**
The Wasm Kernel runs on IDs (Integers). The React Host runs on Assets (Files).

**Missing Components:**
1.  **The ID Registry:**
    *   Wasm emits: `EVT_PLAY_SOUND(104)`.
    *   React needs: `SoundMap.get(104) -> "audio/fireball_impact.mp3"`.
2.  **Dynamic Asset Loading:**
    *   We cannot hardcode all assets if the world is generative.

---

## 5. THE PERFORMANCE GAP (Entity Scheduling)

**The Problem:**
In v3.3, Environmental Effects (Fire, Gas, Spawners) are Entities. A large level could generate 500+ active entities.

**Missing Components:**
1.  **The Scheduler:**
    *   We cannot run 500 scripts every turn (16ms budget).
    *   *Solution:* **Distance-Based Time Slicing**.
        *   Dist < 20 tiles: Update Every Turn.
        *   Dist < 50 tiles: Update Every 5 Turns.
        *   Dist > 50 tiles: Frozen.
