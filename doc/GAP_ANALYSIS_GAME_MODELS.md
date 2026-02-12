# GAP ANALYSIS: GAME MODELING & PORTABILITY (v2.1)

> **Focus:** Expanding the "Multiverse" beyond spatial simulation.
> **Correction:** "Stack-based language" does not mean "Stack-based gameplay".
> **Core Problem:** Dynamic State Management in Linear Memory is inefficient.

## 1. THE STATE MANAGEMENT GAP (Container vs. Logic)

In Spatial games (Grid/Hex), the state is simple: `EntityID -> Coordinate (Int)`. Linear memory handles this well.
In Abstract games (Card, RPG, Detective), state is complex: `Lists`, `Maps`, `Graphs`, `Inventories`.

### The Fallacy
Trying to implement a "Card Deck" (dynamic array) or a "Quest Log" (HashMap) inside the Wasm Linear Memory using Forth is:
1.  **Inefficient:** Requires writing a memory allocator in Forth.
2.  **Redundant:** JavaScript V8 is highly optimized for Arrays and Objects.
3.  **Hard to Serialize:** Extracting a linked list from raw bytes to save to Firebase is painful.

### The Solution: Hybrid State
*   **JavaScript (The Container):** Holds the Data Structures (The Deck, The Inventory, The Quest Flags).
*   **Wasm (The Calculator):** Holds the **Rules** and **Transient Variables** (Math, RNG, Logic resolution).

---

## 2. THE GENRE REGISTRY EXPANSION

We need to model games based on their **Logic Density**, not their spatial topology.

### A. The Deckbuilder (Logic-Heavy)
*   **Gap:** We need a way for a Card Script to say "Draw 2 Cards" without Wasm knowing what a "Deck" is.
*   **Solution:** **Callback Events**.
    *   Wasm Script: `2 CMD_DRAW_CARDS`
    *   Wasm Logic: Pushes `EVT_REQUEST_DRAW(2)` to Output Queue.
    *   JS Logic: Pops event, moves 2 items from `Deck[]` to `Hand[]`.

### B. The Idle/Tycoon (Math-Heavy)
*   **Gap:** Handling massive numbers and offline time calculation securely.
*   **Solution:** Wasm `i64` math.
    *   JS sends: `TimeDelta`, `CurrentResources[]`.
    *   Wasm runs: `ProductionFormulas` (AI Generated).
    *   Wasm returns: `ProductionDelta[]`.

### C. The Interactive Fiction (Flag-Heavy)
*   **Gap:** Complex dependency graphs for puzzles ("If Key Used AND Guard Sleeping").
*   **Solution:** Bitmask State.
    *   JS holds the "Inventory" (Strings).
    *   Wasm holds a `GameFlags` bitmask (Integers).
    *   AI Scripts check flags efficiently in Wasm to determine valid transitions.

---

## 3. THE INPUT GAP (Abstraction)

We need a unified way to "Touch" the simulation, regardless of genre.

*   **Spatial:** `Touch(x, y)` -> Mapped to Tile.
*   **Abstract:** `Touch(index)` -> Mapped to Slot ID.

**Architecture Update:** The Input Queue should accept a generic `TARGET_ID`.
*   In Grid: `TARGET_ID` is the Entity at that tile.
*   In Deck: `TARGET_ID` is the Card unique ID.
*   In Menu: `TARGET_ID` is the Button ID.

---

## 4. THE INVENTORY TRANSLATION GAP (The Heuristic)

How does an item persist across genres? We abandon the idea of "Perfect Polymorphism" (defining 5 scripts for every item).

*   **The Problem:** Generating unique Card/Tycoon mechanics for a "Rusty Dagger" is overkill.
*   **The Solution:** **Tag-Based Resonance.**
    *   The Item has a **Core Identity**: `Name`, `Tier`, and `Tags`.
    *   **Grid Mode:** Uses explicit Stats (`Damage: 5`).
    *   **Deck Mode:** The Engine procedurally matches Tags to a Template.
        *   Item: "Flaming Sword" (`WEAPON`, `FIRE`, `TIER_2`).
        *   System Lookup: `Template(WEAPON) + Modifier(FIRE) * Tier(2)`.
        *   Result: A generic "Fire Slash" card with the label "Flaming Sword".
    *   **Puzzle Mode:** Only Tags matter. "Flaming Sword" -> `TAG:FIRE`. Can it burn the web? Yes.
*   **Benefit:** The AI only generates the Object *once*. The Game Mode interprets it.
