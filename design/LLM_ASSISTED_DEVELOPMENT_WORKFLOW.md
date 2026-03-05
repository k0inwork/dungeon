# Aethelgard: Automated LLM-Assisted AJS Development Workflow

## 1. Vision and Philosophy

Aethelgard’s architecture is uniquely suited for AI-assisted development because of its strict separation of concerns. By isolating the game's logic, physics, and rulesets within WebAssembly Forth (WAForth) kernels transpiled from a specialized subset of JavaScript (AJS), we can safely expose the entire "immutable laws" of the game to an LLM.

The core philosophy of this workflow is the **AJS-Only Viewport**. The LLM operates as a specialized co-developer whose sole domain is the Aethelgard Logic Tier. It does not see the React UI, the Vite build system, or the raw Forth internals. To the LLM, the project is purely a collection of AJS files, C-style struct definitions, and kernel configurations.

This constraints-driven environment forces the LLM to write highly optimized, predictable, and memory-safe logic (e.g., no closures, strict fixed-size memory layouts, O(1) array traversals), effectively turning the LLM into a hyper-efficient systems programmer for the game world.

## 2. The AJS-Only Viewport (LLM Environment Abstraction)

To prevent the LLM from becoming overwhelmed or hallucinating invalid React/Host code, we must provide an abstracted interface or tooling wrapper.

*   **Virtual File System (VFS):** The LLM is restricted to a specific subset of directories, primarily:
    *   `src/kernels/` (The AJS logic for Grid, Hive, Player, Battle, etc.)
    *   `src/config/LevelConfig.ts` (Routing and manifold definitions mapped to AJS)
    *   `Protocol.ts` / VSO Registry definitions (The struct layouts)
*   **AJS Constraints as Guardrails:** The LLM must adhere strictly to AJS rules. Standard JavaScript objects (`{}`) are strictly forbidden. It must use flat C-style structs and Dynamic Chunked Arrays. Closures are unsupported.
*   **The Black Box Host:** The React rendering layer and the core `AetherTranspiler` engine are treated as immutable black boxes. The LLM's goal is to feed perfect AJS into the transpiler.

## 3. The LLM Co-Developer Lifecycle

The workflow for adding a new feature (e.g., a new "Vampire" race with life-steal mechanics, or an entirely new "Swamp" terrain kernel) follows a strict, automated cycle:

### Phase 1: Goal Formulation & Planning
1.  **Human Input:** The developer provides a high-level prompt: *"Create a new 'Swamp' terrain kernel. It should have a slow-movement penalty for entities without the 'Amphibious' trait and apply a poison status effect every 10 ticks."*
2.  **LLM Analysis:** The LLM reads the existing `GridKernel.ts` and `HiveKernel.ts` to understand how terrain penalties and status effects are currently handled via VSO structs and static proposals.
3.  **LLM Proposal:** The LLM outlines a plan (e.g., "Create `SwampKernel.ts`, add `Amphibious` trait to `Protocol.ts`, update `LevelConfig.ts` to route Swamp levels to the new kernel").

### Phase 2: Automated AJS Generation & Modification
The LLM autonomously generates the necessary AJS code using standard file writing tools.
1.  **Struct Definition:** It modifies the VSO registry (if permitted) to add the `Amphibious` boolean flag to the `EntityStats` struct.
2.  **Logic Implementation:** It creates `src/kernels/SwampKernel.ts`, implementing the required AJS functions (e.g., an `apply_terrain_effects` loop utilizing the chunked array traversal).
3.  **Configuration:** It updates configuration files so the Host knows to spawn the new kernel for specific map seeds.

### Phase 3: Transpilation & Automated Testing
The LLM must verify its work. It utilizes a custom test runner command (e.g., `npm run test:ajs -- SwampKernel`).
1.  **AetherTranspiler Hook:** The system attempts to compile the new AJS code. If the LLM uses forbidden JS syntax (e.g., a standard object or a closure), the transpiler immediately throws a specific AST parsing error.
2.  **Headless Execution:** If compilation succeeds, the test runner boots a headless WAForth instance of the kernel and runs a mock simulation tick.

### Phase 4: The Debugging & Feedback Cycle
If the tests fail, the LLM enters an automated feedback loop.
1.  **Stack Leaks (`[ASSERT_STACK]`):** If the LLM wrote AJS that left unhandled values on the stack, the engine throws an error like `[ASSERT_STACK] Failed! Expected 0, got 1`. Crucially, the custom test runner translates the Forth trace back to the exact AJS line number and provides it to the LLM.
2.  **Execution Crashes (`EXEC ERROR`):** If a memory bounds check fails or an invalid struct offset is accessed, the `Aethelgard Debug Analyzer` (`scripts/aethel_analyzer.py`) captures the error and feeds the exact trace telemetry back to the LLM.
3.  **Refactoring:** The LLM analyzes the specific AJS line, identifies the flaw (e.g., forgot to `DROP` a evaluated expression in a `switch` statement), modifies the AJS file, and re-triggers Phase 3 until all tests pass.

## 4. Implications & Architectural Impact

### 4.1 Safety Through Confinement
By confining the LLM exclusively to the AJS logic tier, the risk of it breaking the complex React Host routing or the underlying Vite build process is eliminated. The LLM can drastically alter the *rules* of the game (the physics, the AI, the spells) without ever touching the *infrastructure* that runs the game.

### 4.2 Forced Optimization
The strict constraints of AJS (chunked dynamic arrays, C-style structs, manual memory mapping via VSOs) force the LLM to write code that is inherently performant. It cannot rely on lazy JavaScript garbage collection or bloated object maps. This ensures that any LLM-generated kernel logic runs at near-native speeds within the WAForth environment.

### 4.3 Resolving Systemic Conflicts (The Overseer Model)
When adding complex new mechanics (e.g., a Quest Overseer that overrides standard NPC behavior), the LLM must adhere to Aethelgard's static proposal architecture. It cannot inject dynamic, unpredictable overrides during a tick. It must learn to write static behavior proposals that are evaluated during level load, ensuring that emergent, deeply systemic interactions remain deterministic and debuggable.

### 4.4 The Need for a "Translator" Tool
The primary challenge of this workflow is bridging the gap between Forth errors and AJS logic. A critical piece of tooling required for this workflow to succeed is a robust source-map translator. When the WAForth engine crashes or leaks a stack frame, the error must be perfectly mapped back to the LLM's AJS code. If the LLM only receives raw Forth hex dumps, the debugging cycle will stall. The `AetherTranspiler`'s `DEBUG_MODE` and symbol table generation are essential prerequisites for this.
