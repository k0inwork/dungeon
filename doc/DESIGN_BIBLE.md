# AETHELGARD ENGINE: SYSTEM BIBLE (v1.0)

> **Status:** READY FOR IMPLEMENTATION
> **Classification:** Neuro-Symbolic Roguelike Engine
> **Visual Style:** Unified Terminal (ASCII/Unicode)
> **Architecture:** Coprocessor Model (JS Host + Wasm VM)
> **Runtime:** React 19 + WAForth (WebAssembly)

---

## 1. CORE PHILOSOPHY: THE TERMINAL IS THE WORLD

We reject high-fidelity graphics. We embrace the **Glyph**.
*   **The World:** A grid of characters.
*   **The Asset:** A definition of `{ symbol: string, color: string }`.
*   **The Benefit:** The AI can hallucinate "A red dragon" and we can render it immediately as a red `D`. We do not need to generate sprites.

---

## 2. THE COPROCESSOR (Hybrid Runtime)

### A. The Host (JavaScript) - "The Renderer & Phys-Lite"
*   **Role:** Manages the Display Grid, Input, and Real-Time Physics (Platformer).
*   **Render Strategy:** `Canvas.fillText()` drawing from a shared ArrayBuffer.
*   **Platformer Logic:** Gravity and Collision are calculated in JS floats, but snapped to the ASCII grid for rendering.

### B. The Guest (WebAssembly) - "The Logic Core"
*   **Role:** The Rule Engine.
*   **Trigger:** Called whenever a **Significant Action** occurs (Skill use, Interaction, Turn End).
*   **Reasoning:** Wasm allows the same "Fireball Script" to run in the Platformer (Side View) and the Dungeon (Top Down) without rewriting code.

---

## 3. THE MANIFOLDS (ASCII Flavors)

### 3.1 ORTHOGONAL (Top-Down)
*   **View:** Standard Roguelike. `At` (@) vs `D`.
*   **Physics:** Turn-Based Wasm.

### 3.2 GRAVITY (Side-View)
*   **View:** ASCII Side-Scroller (like *Jetpack* or *ZZT*).
*   **Physics:** Real-Time JS (Float math).
*   **Rendering:** Sub-pixel positions are quantized to the nearest character cell.
*   **Action:** When Player presses 'F' (Cast), JS pauses, calls `Wasm.EXECUTE_SKILL()`, processes the result, then resumes gravity.

---

## 4. PHYSICS & ENVIRONMENT

### 4.1 The "Static Object" Rule
*   **Decision:** Environmental hazards (Fire, Gas) are **Entities**, not Automata.
*   **Constraint:** **Fire does not spread.**
    *   If the AI generates a "Fire Wall", it creates static Fire Entities.
    *   They damage things that touch them.
    *   They do not multiply. This preserves performance and game balance.

### 4.2 Particle Effects
*   **Implementation:** ASCII Particles.
*   **Visual:** `*`, `.`, `,`, `°` moving across the character grid.
*   **Storage:** Transient JS Array (does not exist in Wasm).
