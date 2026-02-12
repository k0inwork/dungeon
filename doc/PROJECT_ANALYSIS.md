
# AETHELGARD PROJECT ANALYSIS (v1.0)

## 1. SYSTEM ARCHITECTURE OVERVIEW
The project implements a **Hybrid Runtime Game Engine** using React for the presentation layer and WAForth (WebAssembly) for the physics/logic kernel.

### Components
*   **Host (JavaScript/React):** Handles Rendering (`Canvas`), Input, Network (Gemini API), and Orchestration.
*   **Guest (Forth/Wasm):** Handles Spatial Logic (`GridKernel`), Entity Management, and collision resolution.
*   **Bridge:** `WaForthService` acts as the interop layer, binding JS functions (`JS_LOG`) to Forth words.

## 2. DETECTED DISCREPANCIES

### 2.1 Kernel Loading & Compilation Stability
*   **Issue:** Users report `undefined word` errors (e.g., `JS_LOG`, `CMOVE`).
*   **Analysis:** The Forth dictionary is strictly linear. If a block fails to compile (e.g., due to a syntax error), subsequent words are not defined.
*   **Correction:** `SharedBlocks.ts` now includes `BLOCK_CORE_POLYFILLS` to ensure non-standard words like `CMOVE` and `2DROP` are present. `JS_LOG` must be bound *before* any kernel code is interpreted.
*   **Risk:** `waforth` asynchronous loading might cause a race condition if `bootProcess` is not fully awaited before `run` is called.

### 2.2 Input Handling
*   **Issue:** `index.tsx` has a `keydown` listener, but it is currently empty (`// We can send INPUT events to PLAYER kernel here`).
*   **Impact:** The player cannot move.
*   **Fix Required:** Implement `forthService.get("PLAYER").run(...)` inside the event listener to inject input opcodes into the Wasm buffer.

### 2.3 Asset Consistency
*   **Issue:** `MapGenerator.ts` generates ASCII layouts, but `index.tsx` relies on `terrain_legend` lookup.
*   **Impact:** If the AI generates a map with a symbol (e.g., `+` for door) but forgets to add it to the `terrain_legend`, it renders as an invisible or default gray tile.
*   **Fix Required:** Add a "Fallback Material" in `index.tsx` for unknown symbols.

## 3. ROOM FOR IMPROVEMENT

### 3.1 Architecture
*   **Unified Input Bus:** Instead of direct kernel calls, implement a `InputSystem.ts` that maps keys to Abstract Actions (`ACTION_UP`, `ACTION_INTERACT`) and pushes them to the `INPUT_QUEUE`.
*   **Save States:** Serialize the Wasm Memory (`ENTITY_TABLE`) to IndexedDB to allow page reloads.

### 3.2 Visuals
*   **Interpolation:** The Platformer mode runs at 60fps, but the Grid mode is tick-based. Adding visual interpolation for grid movement would make it smoother.
*   **CRT Shader:** The current look is clean. Adding a WebGL fragment shader for scanlines/glow would enhance the "Terminal" aesthetic.

### 3.3 AI Integration
*   **Streaming:** Currently waits for full JSON response. Implementing streaming JSON parsing would allow the "World" to build tile-by-tile in real-time.
*   **Error Recovery:** If the AI generates invalid AetherScript, the game logs an error but the entity loses functionality. Implementing a "Safe Mode" script fallback would improve resilience.

## 4. IMMEDIATE ACTION ITEMS
1.  **Wire up Controls:** Connect Arrow Keys to `PLAYER` kernel.
2.  **Fix Polyfills:** Ensure `SharedBlocks` are loaded first.
3.  **Debug Console:** Enhance `DebuggerConsole` to show the Stack Depth.
