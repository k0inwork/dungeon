# AETHELGARD IMPLEMENTATION INDEX

> **Status:** ACTIVE
> **Target:** v1.0 (Unified Terminal Core)

## PHASE 1: THE ENGINE BOOTSTRAP
*   **File:** `imp/01_BOOTSTRAP.md`
*   **Goal:** Initialize React and WAForth. Establish the "Hello World" bridge.
*   **Key Tech:** `waforth`, `React 19`.

## PHASE 2: THE VISUAL CORTEX
*   **File:** `imp/02_RENDERER.md`
*   **Goal:** 60FPS ASCII Rendering using Shared Memory.
*   **Key Tech:** `Canvas API`, `Uint32Array` (Shared Buffer).

## PHASE 3: THE BABEL FISH (TRANSPILER)
*   **File:** `imp/03_TRANSPILER.md`
*   **Goal:** Convert AetherJS (AI Code) into Forth (Wasm Code).
*   **Key Tech:** `acorn` (AST Parser), Recursive Visitor Pattern.

## PHASE 4: THE SKELETON (WASM KERNEL)
*   **File:** `imp/04_KERNEL_GRID.md`
*   **Goal:** Implement the Orthogonal Physics Engine in pure Forth.
*   **Key Tech:** Forth, Linear Memory Management, A* Pathfinding.

## PHASE 5: THE FLESH (AI INTEGRATION)
*   **File:** `imp/05_GENERATOR.md`
*   **Goal:** Connect Gemini API to the Engine. Implement the Generation Pipeline.
*   **Key Tech:** `@google/genai`, JSON Schema Validation.
