# CONTEXT: DESIGN PRINCIPLES (TAXONOMY)

> **Instruction:** Use this schema when generating `Races`, `Classes`, and `Origins`.

## 1. THE TRINITY OF IDENTITY
An entity is defined by the sum of three parts:
`Entity = Race (Body) + Class (Job) + Origin (Allegiance)`

### A. RACE (The Vessel)
*   **Philosophy:** "What you are."
*   **Data:**
    *   `baseHp`: Health (50-200).
    *   `baseSpeed`: Action accumulation (5-15).
    *   `resistances`: Array[6] of integers.
    *   `passive`: A script that runs automatically (e.g., "Heal 1 HP per turn").
*   **Balance:**
    *   High HP -> Low Speed.
    *   High Resistance -> Low HP.

### B. CLASS (The Discipline)
*   **Philosophy:** "What you do."
*   **Data:**
    *   `activeSkills`: List of 2-4 Scripts (Attacks, Heals, Buffs).
    *   `loadout`: Starting items.
*   **Roles:**
    *   **Striker:** High Dmg, Low Range.
    *   **Caster:** High Range, High Cost.
    *   **Warden:** High Defense, Low Speed.

### C. ORIGIN (The Soul)
*   **Philosophy:** "Who you know."
*   **Data:**
    *   `tags`: String array (e.g., `["ROYAL", "OUTLAW"]`).
    *   `utilitySkill`: One niche script (e.g., "Unlock Door", "Bribe").
*   **Mechanic:** AI Factions use `tags` to decide `TARGET` or `ALLY`.

## 2. GENERATION RULES
1.  **Distinctiveness:** No two races should have the same highest stat.
2.  **Synergy:** Classes should rely on stats provided by Races. (e.g., A "Berserker" class needs a Race with high HP).
3.  **Thematic Naming:** Do not use generic names ("Fighter"). Use thematic names ("Chromebreaker", "Aether-Knight").
