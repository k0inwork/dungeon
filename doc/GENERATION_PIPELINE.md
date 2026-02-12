# AETHELGARD GENERATION PIPELINE (v1.3)

> **Philosophy:** "The Snowball Effect."
> **Process:** Input N becomes the Context for Input N+1.

## PHASE 1: THE CODEX (Lore & Theme)
*   **Input:** User Prompt (e.g., "Cyberpunk Vampires in a flooded London").
*   **Context:** None.
*   **Output:** `WorldTheme` Object.
    *   *Name:* "Neo-Sanguine Archipelago"
    *   *Tone:* Gothic Industrial
    *   *Keywords:* [Blood, Rust, Neon, Water]

## PHASE 2: THE PHYSICS (The Battle Bible)
*   **Input:** `WorldTheme`.
*   **Context:** `doc/context/BATTLE_PRINCIPLES.md`
*   **Output:** `CombatRules` Object.
    *   *Damage Types:* Redefines standard types (e.g., "Fire" becomes "Plasma", "Holy" becomes "Admin Access").
    *   *Status Effects:* Defines unique buffs/debuffs (e.g., "Rust: -1 Armor/turn").

## PHASE 3: THE BIOLOGY (Races)
*   **Input:** `WorldTheme` + `CombatRules`.
*   **Context:** `doc/ENTITY_TAXONOMY.md` + `doc/context/SCRIPT_REF.md`
*   **Output:** `RaceRegistry` (List of 3-5 Races).
    *   *Requirement:* Must include `baseSpeed` and one `PassiveSkill` script.

## PHASE 4: THE SOCIOLOGY (Classes & Origins)
*   **Input:** `WorldTheme` + `CombatRules` + `RaceRegistry`.
*   **Context:** `doc/ENTITY_TAXONOMY.md` + `doc/context/SCRIPT_REF.md`
*   **Output:** `ClassRegistry` and `OriginRegistry`.
    *   *Requirement:* Classes provide `ActiveSkills` (Combat). Origins provide `UtilitySkills` (Tags/Social).

## PHASE 4.5: THE ARMORY (Artifacts)
*   **Input:** `WorldTheme` + `CombatRules` + `ClassRegistry`.
*   **Context:** `doc/ARTIFACT_TAXONOMY.md`
*   **Output:** `ItemRegistry` (List of 10-20 Items).
    *   **Weapons:** Synergized with Class Skills (e.g., if Class is "Sniper", generate "Railgun").
    *   **Curios:** Plot items derived from Lore (e.g., "Key to the Sanguine Vault").

## PHASE 5: THE CARTOGRAPHY (The World Map)
*   **Input:** All previous outputs.
*   **Context:** `doc/context/TERRAIN_PRINCIPLES.md`
*   **Output:** `LevelGraph`.
    *   *Biomes:* Mapped to Damage Types (e.g., Plasma Lake).
    *   *Topology:* Sector Layout.

---

## PHASE 6: THE CRUCIBLE (Validation & Correction)
*   **Trigger:** Executed automatically after Phase 3, 4, and 4.5.
*   **Process:**
    1.  **Extract:** Pull all JS/Py scripts from the generated JSON.
    2.  **Lint:** Run `Transpiler.validate(script)`.
    3.  **Check:**
        *   If `isValid == true`: Proceed.
        *   If `isValid == false`: Trigger **Correction Loop**.
    4.  **Correction Loop (Max 3 Retries):**
        *   Feed `script` + `error_log` back to AI.
        *   Request fixed script.
        *   Re-Lint.

---

## EXECUTION ORDER

1.  **System:** `GenerateTheme(userInput)` -> JSON
2.  **System:** `GenerateDamageTypes(Theme)` -> JSON
3.  **System:** `GenerateRaces(Theme, DamageTypes)` -> JSON (Includes Scripts)
4.  **System:** `RunCrucible(Races)` -> JSON (Validated)
5.  **System:** `GenerateClasses(Theme, DamageTypes)` -> JSON (Includes Scripts)
6.  **System:** `RunCrucible(Classes)` -> JSON (Validated)
7.  **System:** `GenerateItems(Theme, Classes)` -> JSON (Includes Scripts)
8.  **System:** `RunCrucible(Items)` -> JSON (Validated)
9.  **System:** `TranspileAllScripts(Races, Classes, Items)` -> Wasm/Forth
