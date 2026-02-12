# THE FLESH: ENTITY TAXONOMY (v1.1)

> **Context:** v1.1 Update (Schema Alignment).
> **Philosophy:** "Identity is the intersection of Biology, Discipline, and History."
> **Counterpart:** See `doc/ARTIFACT_TAXONOMY.md` for Inanimate Objects.

---

## 1. THE TRINITY OF IDENTITY

Every living entity in the Aethelgard Engine is constructed from three data blocks.
`Entity = Race + Class + Origin`.

### 1.1 Race (The Hardware)
Defines the physical limitations and metabolic baseline.
*   **Base HP:** The physical durability.
*   **Base Speed:** The rate of AP accumulation.
*   **Resistances:** Fixed array of percentage reductions.
*   **Innate Skill:** A `PASSIVE` script (e.g., "Regenerate").

### 1.2 Class (The Software)
Defines combat capabilities and resource management.
*   **Active Skills:** List of 2-4 `ACTIVE` scripts.
*   **Loadout:** Default `ARTIFACT` IDs.
*   **Growth:** Stat multipliers per Level.

### 1.3 Origin (The Network)
Defines social location and diplomatic relations.
*   **Tags:** Strings used for Faction Logic (e.g., `NOBLE`, `CRIMINAL`).
*   **Utility Skill:** Non-combat resolution (e.g., `PickLock`).

---

## 2. THE ENTITY INSTANCE SCHEMA

When the AI generates a specific Entity (e.g., a Mob on a Map), it **MUST** include the Taxonomy block.

```json
{
  "id": "npc_guard_01",
  "name": "Corporal Vimes",
  "taxonomy": {
    "race": "Human",       // Defines Base Stats
    "class": "Sentinel",   // Defines Active Skills
    "origin": "City Watch" // Defines Tags
  },
  "stats": {
    "hp": 120,    // Derived from Human BaseHP + Level Scalar
    "speed": 10,  // Derived from Human BaseSpeed
    "level": 3
  },
  "tags": ["HUMAN", "LAW_ENFORCEMENT", "ARMORED"], // Union of all 3 sources
  "glyph": { "char": "h", "color": "#CCCCFF" },
  "scripts": {
    "passive": "Regen(1)",          // From Race
    "active": ["ShieldBash", "Halt"], // From Class
    "utility": "Arrest"             // From Origin
  }
}
```

---

## 3. THE SKILL ARCHITECTURE

A "Skill" is a structured container for an `AetherScript`.

### 3.1 Skill Schema
```json
{
  "id": "skill_pyroblast",
  "name": "Pyroblast",
  "type": "ACTIVE",
  "cost": {
    "energy": 20
  },
  "targeting": {
    "range": 5,
    "shape": "SINGLE",
    "req_los": true
  },
  "script": "VFX(FIRE_BALL); Damage(Target, 50, TYPE_THERMAL);"
}
```

---

## 4. EXAMPLE PROFILES

### Profile A: The "Tank"
*   **Taxonomy:** `{ race: "Golem", class: "Sentinel", origin: "RoyalGuard" }`
*   **Logic:**
    *   *Golem* gives High Res & Slow Speed.
    *   *Sentinel* gives `Taunt` script.
    *   *RoyalGuard* gives `KINGDOM` tag.
*   **Result:** A slow wall that protects `KINGDOM` allies.

### Profile B: The "Glass Cannon"
*   **Taxonomy:** `{ race: "Elf", class: "Pyromancer", origin: "Cultist" }`
*   **Logic:**
    *   *Elf* gives Low Res & High Speed.
    *   *Pyromancer* gives `Fireball` script.
    *   *Cultist* gives `HERETIC` tag.
*   **Result:** Dies in one hit, but clears the room if ignored.
