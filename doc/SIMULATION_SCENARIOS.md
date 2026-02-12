# SIMULATION SCENARIOS: FROM PROMPT TO PIXEL (v3.2)

> **Objective:** defining the "End-to-End" flow for every supported Game Manifold.
> **Philosophy:** The User provides the *Dream*. The System provides the *Constraints*. The AI provides the *Code*.

---

## 1. THE GENERATION META-FLOW

For all scenarios below, the engine follows this strict pipeline:

1.  **THE SEED:** User types a raw prompt (e.g., "Cyberpunk Vampires").
2.  **THE INJECTION:** The Engine wraps the prompt with our **Taxonomy Documents** (`ENTITY_TAXONOMY`, `BATTLE_PRINCIPLES`, `ASSET_MANIFEST`).
3.  **THE HALLUCINATION:** The AI returns a strictly typed JSON object containing World Settings, Entity Definitions, and Scripts.
4.  **THE COMPILATION:** The Engine transpiles AI-Scripts to Forth and loads them into the Wasm Kernel.
5.  **THE REVIEW:** User sees the **Architect View** (Data Inspection).
6.  **THE SIMULATION:** User switches to **Gameplay View** (Terminal Interaction).

---

## SCENARIO A: THE ROGUELIKE (Orthogonal Manifold)
**Kernel:** `grid_core.fs`
**Theme:** "Bio-Horror Laboratory escape."

### 1. The Request
> **User:** "Create a bio-lab overrun by mutants. The player is a test subject trying to escape. High lethality."

### 2. The Context Injection
*   `doc/context/BATTLE_PRINCIPLES.md` (Defines Damage Types: BIOTIC, KINETIC).
*   `doc/ENTITY_TAXONOMY.md` (Defines Race/Class/Origin schema).

### 3. The AI Response (JSON)
```json
{
  "theme": "Sector 4 Bio-Lab",
  "entities": [
    {
      "id": "mutant_rat_01",
      "taxonomy": {
        "race": "Vermin",
        "class": "Scavenger",
        "origin": "Lab_Specimen"
      },
      "glyph": { "char": "r", "color": "#00FF00" },
      "stats": { "hp": 20, "speed": 12 },
      "tags": ["BEAST", "MUTANT", "TOXIC"],
      "ai_behavior": "PACK",
      "scripts": {
        "active": [
             "onAttack: Damage(Target, 5, TYPE_BIOTIC); ApplyStatus(POISON, 2);"
        ]
      }
    }
  ],
  "map_layout": [
    "####################",
    "#@.......r.........#",
    "#...~~.............#",
    "####################"
  ]
}
```

---

## SCENARIO B: THE PLATFORMER (Gravity Manifold)
**Kernel:** `Engine_Gravity.ts`
**Theme:** "Steampunk vertical shaft."

### 1. The Request
> **User:** "A long vertical mineshaft. Steam vents. Mechanical spiders."

### 3. The AI Response (JSON)
```json
{
  "gravity": 9.8,
  "entities": [
    {
      "id": "steam_vent",
      "taxonomy": { "race": "Construct", "class": "Hazard", "origin": "Infrastructure" },
      "glyph": { "char": "^", "color": "#FFFFFF" },
      "tags": ["STATIC", "MECHANICAL"],
      "collision": "TRIGGER",
      "scripts": {
        "onTouch": "Push(Target, 0, -15); VFX(STEAM_PUFF);"
      }
    },
    {
      "id": "mech_spider",
      "taxonomy": { "race": "Arachnid", "class": "Crawler", "origin": "Automaton" },
      "glyph": { "char": "M", "color": "#FF0000" },
      "tags": ["MECHANICAL", "CLIMBER"],
      "ai_behavior": "PATROL_X",
      "scripts": { "onTouch": "Damage(Target, 10, TYPE_KINETIC);" }
    }
  ]
}
```

---

## SCENARIO C: THE WARGAME (Hex Manifold)
**Kernel:** `hex_core.fs`
**Theme:** "Napoleonic Wars with Magic."

### 1. The Request
> **User:** "Redcoats vs Orcs. Open field."

### 3. The AI Response (JSON)
```json
{
  "map_type": "HEX",
  "units": [
    {
      "id": "musketeer_mage",
      "taxonomy": { "race": "Human", "class": "BattleMage", "origin": "Empire" },
      "glyph": { "char": "i", "color": "#0000FF" },
      "stats": { "range": 4, "move": 3 },
      "tags": ["HUMAN", "IMPERIAL", "MAGIC"],
      "scripts": {
        "attack": "if (Dist > 4) { Fail('Too Far'); } else { Damage(Target, 10, TYPE_KINETIC); }"
      }
    }
  ]
}
```

---

## SCENARIO E: THE DETECTIVE (Narrative Manifold)
**Kernel:** `logic_core.fs`
**Theme:** "Noir Mystery."

### 1. The Request
> **User:** "A rainy alleyway. Dead body. I need to find clues."

### 3. The AI Response (JSON)
```json
{
  "start_node": "alley_entrance",
  "nodes": {
    "alley_entrance": {
      "desc": "Rain lashes against the brick. A body lies slumped.",
      "options": [
        { 
          "label": "Examine Body", 
          "script": "GoTo('node_body_closeup');" 
        },
        { 
          "label": "Search Trash", 
          "script": "if (HasFlag('found_note')) { Log('Empty.'); } else { AddItem('strange_note'); SetFlag('found_note', 1); Log('You found a wet note.'); }"
        }
      ]
    }
  }
}
```
