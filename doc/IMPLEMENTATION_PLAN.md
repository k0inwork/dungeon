# AETHELGARD: IMPLEMENTATION ROADMAP (v1.0)

> **Goal:** Build the "Unified Terminal Core" (v1.0)
> **Stack:** React 19, TypeScript, WAForth.

---

## PHASE 1: THE FOUNDATION (The "Hello World")
*Focus: Getting Wasm running and talking to React.*

- [ ] **1.1 Structure:** Setup `src/systems/` folder structure (`waforth`, `renderer`, `input`).
- [ ] **1.2 Wasm Loader:** Implement `WaForthService.ts` to load `waforth.wasm` and bind `JS_LOG`.
- [ ] **1.3 The Kernel:** Create `public/kernels/grid_core.fs` with a simple Dictionary:
    ```forth
    : BOOT S" Aethelgard Kernel Loaded." JS_LOG ;
    ```
- [ ] **1.4 The Test:** `App.tsx` loads the service and sees the log in the console.

## PHASE 2: THE RENDERER (The "Glyph Engine")
*Focus: Drawing ASCII efficiently.*

- [ ] **2.1 The Buffer:** Create `GlyphBuffer.ts` (Managed `Uint32Array`).
    - Format: `[Char1, Color1, Char2, Color2...]`.
- [ ] **2.2 The Canvas:** Create `TerminalCanvas.tsx`.
    - Uses `requestAnimationFrame`.
    - Iterates `GlyphBuffer` and calls `ctx.fillText`.
- [ ] **2.3 The Font:** Import a clean Monospace font (e.g., "IBM Plex Mono" or built-in "Courier New") and lock the aspect ratio.

## PHASE 3: THE PHYSICS (The "Dungeon")
*Focus: Movement and Collision in Forth.*

- [ ] **3.1 Memory Map:** Define `CONSTANTS` in both TS and Forth for `INPUT_QUEUE`, `OUTPUT_QUEUE`, and `ENTITY_TABLE`.
- [ ] **3.2 Input Bridge:** Implement `InputSystem.ts` to catch Arrow Keys and write `CMD_MOVE` opcodes to Wasm Memory.
- [ ] **3.3 The Kernel Logic (`grid_core.fs`):**
    - Implement `PROCESS_INPUT` loop.
    - Implement `MOVE_ENTITY` logic (update X/Y in memory).
    - Implement `CHECK_COLLISION` (read map data).
- [ ] **3.4 The Output Bridge:**
    - Implement `PROCESS_OUTPUT` in TS to read `EVT_MOVED` and update the `GlyphBuffer`.

## PHASE 4: THE GENERATOR (The "Brain")
*Focus: Connecting Gemini AI.*

- [ ] **4.1 Prompt Engineering:** Create `WorldGenerator.ts`.
    - Prompt: "Generate a JSON Level with 10x10 walls and 1 Goblin."
- [ ] **4.2 The Injector:**
    - Parse JSON.
    - Write Tile IDs to Wasm Terrain Memory.
    - Write Entity Structs to Wasm Entity Memory.
- [ ] **4.3 The Transpiler (Draft):**
    - Implement `compileScript(jsCode)` -> Forth String.
    - Test running dynamic code like `: ON_TOUCH 10 HP - ;`.

---

## PHASE 5: POLISH & EXPANSION (Post-MVP)
- [ ] **5.1** Add "Side View" Hybrid Mode.
- [ ] **5.2** Add Particle Effects (JS side).
- [ ] **5.3** Add Save/Load (Firebase).
