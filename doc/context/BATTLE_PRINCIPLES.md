# CONTEXT: BATTLE PRINCIPLES

> **Instruction:** Use this logic when generating `DamageTypes`, `Weapons`, or `CombatSkills`.

## 1. THE AFFINITY MATRIX
The engine supports exactly **6 Damage Channels**. You must rename/flavor them to fit the World Theme, but their mathematical roles are fixed.

| ID | Role | Standard Name | Example (Sci-Fi) | Example (Horror) |
| :--- | :--- | :--- | :--- | :--- |
| **0** | **KINETIC** | Physical | Ballistic | Blunt |
| **1** | **THERMAL** | Fire | Plasma | Hellfire |
| **2** | **ENTROPIC** | Ice/Decay | Cryo | Rot |
| **3** | **ENERGY** | Volt/Lightning | Laser | Shock |
| **4** | **BIOTIC** | Poison/Nature | Toxin | Blood |
| **5** | **COGNITIVE**| Psychic/Void | Psionic | Fear |

**Rule:** Every Entity has a `Resistance[6]` array (0-100%).
**Calculation:** `Damage = Input * (100 - Resistance[Type]) / 100`.

## 2. STATUS EFFECTS
Effects are binary flags processed at the start of a turn.
*   **DoT (Damage over Time):** Deals 5% MaxHP per turn.
*   **Stun:** Skips turn if `Accumulator > 1.0`.
*   **Root:** Movement = 0.
*   **Silence:** Cannot use `ActiveSkills`.

## 3. ACTION ECONOMY (The Clock)
*   **Speed:** Integers 1 to 20.
*   **The Turn:** Time flows in ticks. `AP += Speed`. When `AP >= 100`, Entity acts.
*   **Implication:** Speed 20 acts twice as fast as Speed 10.
*   **Design Note:** High Speed is the strongest stat. Balance it with low HP.
