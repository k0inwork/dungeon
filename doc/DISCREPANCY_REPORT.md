
# SYSTEM DISCREPANCY & IMPROVEMENT REPORT (v1.0)

> **Date:** Current
> **Status:** ANALYSIS COMPLETE

## 1. CRITICAL DISCREPANCIES

### 1.1 The "Passive Protagonist" Issue
**Observation:** The User notes "Rats attack PC but PC won't attack rats."
**Analysis:** 
*   Currently, the Player only attacks if they **physically collide** with an enemy (bump combat). 
*   There is no UI or Input mechanism to trigger an attack *without* moving.
*   If the Player is stationary, and a Rat moves into them, the Rat triggers a collision event (Source: Rat, Target: Player). The Hive AI sends an attack command. The Player Kernel *does not* automatically retaliate when hit.
*   **Result:** The Player feels unresponsive during enemy turns.

### 1.2 The "Void" Inventory
**Observation:** "We don't have inventory."
**Analysis:**
*   Items are generated in the JSON Lore but are rendered as mere floor tiles or generic entities.
*   There is no `PICKUP` command.
*   There is no UI to display what is held.
*   `PlayerKernel` has reserved memory variables (`INV_0`..`INV_3`) but no logic to manage them.

### 1.3 Active Skill Vacuum
**Observation:** "We don't have active skills at all."
**Analysis:**
*   The `BattleKernel` contains template functions (`skill_fireball` placeholders), but the `GeneratorService` output (AetherJS strings) is not actually transpiled and injected into the Battle Kernel during boot.
*   Even if they were injected, there is no **Targeting System**. A "Fireball" requires a specific target tile (X, Y) or Entity ID. The current Input System only supports directional movement (Arrow Keys).

---

## 2. IMPROVEMENT SPECIFICATION

### 2.1 The Targeting Overlay (GUI)
To solve "Who is the target?", we must implement a **Modal Cursor System**.

*   **State:** `GAME` vs `TARGETING`.
*   **Visuals:** When in `TARGETING`, a flashing bracket `[ ]` appears over the grid.
*   **Input:** Arrow keys move the Cursor instead of the Player.
*   **Action:** `ENTER` selects the entity under the cursor and dispatches `CMD_ATTACK`.

### 2.2 The Skill Bar (UI)
*   **Visuals:** A list of available skills (1-9) at the bottom of the screen.
*   **Data Source:** `PlayerKernel` should output the list of learned skills (derived from Class/Race).
*   **Interaction:** Pressing `1` selects Skill 1 and enters Targeting Mode.

### 2.3 Battle Kernel Expansion
*   **Dynamic Dispatch:** The `execute_skill` function must handle Range Checks.
*   **Logic:** 
    *   `IF (Distance(Src, Tgt) > Skill.Range) RETURN FAIL;`
    *   `Calculate Damage based on Skill.Type vs Target.Resistances.`

---

## 3. IMPLEMENTATION PLAN (Immediate)

1.  **UI Update:** Add `TargetingMode` to `index.tsx` and `TerminalCanvas`.
2.  **Input Update:** Map `t` or `1-4` to toggle Targeting. Map `Enter` to confirm.
3.  **Kernel Update:** Update `BattleKernel` to support a Ranged Fireball skill.
