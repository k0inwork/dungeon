# THE RELIQUARY: ARTIFACT TAXONOMY (v2.0)

> **Context:** v2.0 Simplified Model.
> **Philosophy:** "An Object is defined by its Nature, not its Function."
> **Distinction:** Entities have *Agency*. Artifacts have *Tags*.

---

## 1. THE ARTIFACT SCHEMA

We strip away specific "Card Scripts" or "Tycoon Stats". We keep only the physical truth.

```json
{
  "id": "artifact_flame_brand",
  "name": "Brand of the Old King",
  "category": "WEAPON",
  "tier": 2, // 1 (Common) to 5 (Legendary)
  "tags": ["FIRE", "ROYAL", "METAL"],
  "physics": {
    "weight": 5,
    "bulk": 2,
    "durability": 100
  },
  "grid_stats": {
    // Only the primary game mode (Grid) gets specific hardcoded stats
    "damage": 15,
    "range": 1,
    "damage_type": "THERMAL"
  }
}
```

---

## 2. CATEGORIES OF MATTER

### A. THE TOOL (Weapons & Utilites)
*   **Role:** Extends the user's capability.
*   **Tags:** `WEAPON`, `DIGGING`, `LIGHT_SOURCE`.

### B. THE WARD (Armor & Clothing)
*   **Role:** Mitigates incoming vectors.
*   **Tags:** `ARMOR`, `COLD_RESIST`, `STEALTH`.

### C. THE CATALYST (Consumables)
*   **Role:** Single-use state mutation.
*   **Tags:** `HEAL`, `EXPLOSIVE`, `POISON`.

### D. THE CURIO (Key Items)
*   **Role:** Narrative logic gates.
*   **Tags:** `KEY`, `INTEL`, `VALUABLE`.

---

## 3. CROSS-REALITY TRANSLATION (The Resonance System)

When an item moves from the **Grid** (Physical) to an **Abstract Manifold**, it is "interpreted" by that Manifold's ruleset.

### 3.1 To Deckbuilder (The Duelist)
The engine maintains a library of **Card Templates**. It maps Item Tags to Templates.

*   **Input:** "Brand of the Old King" (`WEAPON`, `FIRE`, `TIER 2`).
*   **Mapping:**
    *   `WEAPON` -> Selects `Template: Attack`.
    *   `FIRE` -> Adds Effect `Apply Burn(Tier * 2)`.
    *   `TIER 2` -> Sets Damage to `6 * Tier` (12).
*   **Resulting Card:** "Brand of the Old King: Deal 12 Damage. Apply 4 Burn."

### 3.2 To Tycoon (The Ledger)
The engine maps Tags to **Production Multipliers**.

*   **Input:** "Brand of the Old King" (`VALUABLE`, `ROYAL`).
*   **Mapping:**
    *   `VALUABLE` -> Increases `Passive Income` by Tier %.
    *   `ROYAL` -> Unlocks `Courtier` visitor types.
*   **Result:** "Passive Gold +2%."

### 3.3 To Puzzle (The Graph)
The engine ignores stats and looks ONLY at Tags for boolean logic.

*   **Input:** "Brand of the Old King" (`FIRE`, `METAL`).
*   **Puzzle:** "A thick ice wall blocks the way."
*   **Check:** `Does Player.Inventory have Tag(FIRE) OR Tag(EXPLOSIVE)?`
*   **Result:** TRUE. Interaction allowed.

---

## 4. GENERATION STRATEGY

The AI's job is simpler now. It just needs to create cool names and assign logical tags.

*   **Prompt:** "Generate a Rare Weapon."
*   **AI Output:**
    *   Name: "Void Dagger"
    *   Tier: 3
    *   Tags: [`WEAPON`, `VOID`, `STEALTH`, `LIGHT`] (Light weight, not light source)
*   **System:** Automatically handles how this works in a Card Game (High Dmg, Low Cost) vs a Puzzle (Can cut ropes).
