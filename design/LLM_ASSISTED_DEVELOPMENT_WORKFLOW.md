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

## 3. Dynamic Kernel Manifests & Trait-Based Instances

A fundamental requirement for this workflow is that Aethelgard supports **dynamic, on-the-fly kernel loading** mapped to specific level traits or themes. The engine is not a monolithic, hardcoded set of kernels. Instead, it is a meta-framework capable of running completely different physical and behavioral laws on a room-by-room basis, while maintaining the overarching roguelike/platform/MUD experience.

When the LLM creates a new rule or race, it is essentially creating a **Kernel Variant**.

*   **Trait Configurations:** `src/config/LevelConfig.ts` will evolve into a "Trait Manifest." For example, if a level rolls the traits `["SWAMP", "VAMPIRE_COVEN", "UNDEAD"]`, the JS Host will dynamically map and boot a specialized `SwampGridKernel`, a custom `VampireHiveKernel`, and an `UndeadBattleKernel`.
*   **Encapsulated Variance:** This allows the LLM to write highly specific, experimental mechanics (like a unique gravity vector or a completely different pathfinding algorithm for a specific boss room) without ever risking regressions in the standard or global game loops. The modifications are contained entirely within their specific dynamic variant.

## 4. The LLM Co-Developer Lifecycle

The workflow for adding a new feature (e.g., a new "Vampire" race with life-steal mechanics, or an entirely new "Swamp" terrain kernel) follows a strict, automated cycle:

### Phase 1: Goal Formulation & Planning
1.  **Human Input:** The developer provides a high-level prompt: *"Create a new 'Swamp' terrain kernel. It should have a slow-movement penalty for entities without the 'Amphibious' trait and apply a poison status effect every 10 ticks. Add this to the Trait Manifest."*
2.  **LLM Analysis:** The LLM reads the standard `GridKernel.ts` as a base template, and understands how terrain penalties and status effects are currently handled via VSO structs and static proposals.
3.  **LLM Proposal:** The LLM outlines a plan (e.g., "Fork `GridKernel.ts` into a dynamic variant `SwampGridKernel.ts`, add the `Amphibious` trait to `Protocol.ts`, update `LevelConfig.ts` to dynamically boot this variant for 'SWAMP' traits").

### Phase 2: Automated AJS Generation & Modification
The LLM autonomously generates the necessary AJS code using standard file writing tools.
1.  **Struct Definition:** It modifies the VSO registry (if permitted) to add the `Amphibious` boolean flag to the `EntityStats` struct.
2.  **Logic Implementation:** It creates the specialized dynamic variant `src/kernels/variants/SwampGridKernel.ts`, implementing the required AJS functions (e.g., an `apply_terrain_effects` loop utilizing the chunked array traversal).
3.  **Configuration Mapping:** It updates `LevelConfig.ts` so the Host knows to map the `"SWAMP"` trait to this specific kernel variant during level load.

### Phase 3: Transpilation & Automated Testing
The LLM must verify its work. It utilizes a custom test runner command (e.g., `npm run test:ajs -- SwampGridKernel`).
1.  **AetherTranspiler Hook:** The system attempts to compile the new AJS variant code. If the LLM uses forbidden JS syntax (e.g., a standard object or a closure), the transpiler immediately throws a specific AST parsing error.
2.  **Headless Execution:** If compilation succeeds, the test runner boots a headless WAForth instance of the specific kernel variant and runs a mock simulation tick.

### Phase 4: The Debugging & Feedback Cycle
If the tests fail, the LLM enters an automated feedback loop.
1.  **Stack Leaks (`[ASSERT_STACK]`):** If the LLM wrote AJS that left unhandled values on the stack, the engine throws an error like `[ASSERT_STACK] Failed! Expected 0, got 1`. Crucially, the custom test runner translates the Forth trace back to the exact AJS line number and provides it to the LLM.
2.  **Execution Crashes (`EXEC ERROR`):** If a memory bounds check fails or an invalid struct offset is accessed, the `Aethelgard Debug Analyzer` (`scripts/aethel_analyzer.py`) captures the error and feeds the exact trace telemetry back to the LLM.
3.  **Refactoring:** The LLM analyzes the specific AJS line, identifies the flaw (e.g., forgot to `DROP` a evaluated expression in a `switch` statement), modifies the AJS file, and re-triggers Phase 3 until all tests pass.

### Phase 5: Human-in-the-Loop (HITL) Fallback
While the workflow is heavily automated, the strictness of AJS means the LLM can occasionally become stuck in a failure loop (e.g., repeatedly failing to resolve a complex memory map or infinite loop).
1.  **Failure Threshold:** If the LLM fails to produce passing tests after $N$ attempts (e.g., 5 consecutive transpiler or runtime crashes), the automated loop pauses.
2.  **Human Escalation:** The test runner escalates the issue, presenting the human developer with the LLM's last generated AJS snippet and the persistent error trace.
3.  **Intervention:** The human developer can either:
    *   Provide a specific hint to the LLM via prompt ("You are forgetting to multiply the fixed-point value by 65536").
    *   Manually correct the AJS logic, commit the fix, and instruct the LLM to resume from the next objective.

## 5. Part II: The Narrative Approach (Bi-Storytelling & D&D Style Play)

While the previous sections detailed using the LLM as an offline, automated developer tool, Aethelgard's dynamic kernel loading opens the door for a completely different application: **The LLM as a Real-Time Game Master**.

Because true real-time, autonomous engine generation is incredibly complex, the evolution towards a full D&D session style must be approached in **Four Phased Steps**:

### Step 1: The Offline World Architect (Static Generation)
Before attempting real-time generation, the LLM is used to generate the entire world *offline* before the player begins their session.
1.  **World Bible Generation:** Given a topic (e.g., "Dark Fantasy") and a desired size (e.g., "10 manifolds"), the LLM iteratively produces a structured, static "World Bible" (Markdown/JSON) describing the overarching theme, specific races, origins, terrains, towns, and quests.
2.  **Iterative AJS Compilation:** Once the narrative lore is finalized, the LLM uses the automated developer loop (from Part I) to generate, transpile, and debug all the necessary AJS kernels (`Grid`, `Hive`, `Battle`) for those 10 manifolds. The game is then booted with a fully fleshed-out, static Trait Manifest.

### Step 2: The Horizon Forger (Logical Pre-Generation)
The second step introduces a continuous generation loop, but hides the latency behind exploration. The player starts in a single, pre-generated region.
*   **Thematic Transition:** As the player explores, the LLM generates the *next* region's narrative and AJS mechanics in the background. Crucially, the new region is logically and thematically derived from the current one (e.g., transitioning from a "Swamp" kernel to a "Rotting Delta" kernel).
*   **Hidden Latency:** The transpilation and debugging of the new `RottingDeltaGridKernel` occur while the player is still resolving encounters in the Swamp, ensuring a seamless experience when they finally cross the threshold.

### Step 3: The Curated Game Master (Human-Approved Real-Time)
The third step introduces real-time generation during active gameplay, but with a critical safety net. The LLM acts as a dynamic GM, proposing new mechanics or races as emergent events occur within the current manifold.
*   **Entering the Unknown:** The player steps through a dimensional rift. The LLM GM proposes a "Crystalline Void," instantly writing a new `CrystallineVoidGridKernel.ts` where movement reflects light and causes area-of-effect damage.
*   **The "Approve & Compile" Gate:** Before this new AJS logic is pushed to the engine, a human (either a dedicated human GM or the player themselves) must review the proposed mechanics and click "Approve and Compile." This prevents hallucinated or game-breaking physics from permanently corrupting the active session.

### Step 4: The Autonomous D&D Game Master (Full Real-Time Bi-Storytelling)
The final goal. The LLM handles narrative and real-time AJS engine-forging completely autonomously, bound only by its immutable ledger of past creations, resulting in a seamless, infinite D&D-style session. The human player and the AI GM engage in true "Bi-Storytelling," co-creating the world in real-time.

### 5.1 The Bound Master: Complying with the Forged World
A critical challenge in infinite generative storytelling (Steps 2-4) is hallucination and mechanical inconsistency. To function as a true D&D Game Master, the LLM must eventually become bound by the world it has created.

*   **The Immutable Ledger:** Once the LLM generates a new kernel and transpiles it into WAForth, it is permanently added to the session's **Trait Manifest**. That kernel becomes an immutable law of physics for that specific region.
*   **Contextual Guardrails:** The LLM cannot simply "forget" or randomly rewrite how the Crystalline Void works when the player returns to it hours later. The engine must maintain a strictly formatted ledger of all previously generated AJS kernels, VSO structs, and Trait mappings. This ledger is passed as context to the LLM during every prompt.
*   **Forced Adherence:** If the GM attempts to generate a new monster in a previously established region, it must write the monster's `HiveKernel` logic to comply with the existing spatial rules it established previously in the `GridKernel`. It must build *upon* the VSO structs it already allocated, not infinitely redefine them.

## 6. Implications & Architectural Impact

### 6.1 Safety Through Confinement
By confining the LLM exclusively to the AJS logic tier, the risk of it breaking the complex React Host routing or the underlying Vite build process is eliminated. The LLM can drastically alter the *rules* of the game (the physics, the AI, the spells) without ever touching the *infrastructure* that runs the game.

### 6.2 Forced Optimization
The strict constraints of AJS (chunked dynamic arrays, C-style structs, manual memory mapping via VSOs) force the LLM to write code that is inherently performant. It cannot rely on lazy JavaScript garbage collection or bloated object maps. This ensures that any LLM-generated kernel logic runs at near-native speeds within the WAForth environment.

### 6.3 Resolving Systemic Conflicts (The Overseer Model)
When adding complex new mechanics (e.g., a Quest Overseer that overrides standard NPC behavior), the LLM must adhere to Aethelgard's static proposal architecture. It cannot inject dynamic, unpredictable overrides during a tick. It must learn to write static behavior proposals that are evaluated during level load, ensuring that emergent, deeply systemic interactions remain deterministic and debuggable.

### 6.4 The Need for a "Translator" Tool
The primary challenge of this workflow is bridging the gap between Forth errors and AJS logic. A critical piece of tooling required for this workflow to succeed is a robust source-map translator. When the WAForth engine crashes or leaks a stack frame, the error must be perfectly mapped back to the LLM's AJS code. If the LLM only receives raw Forth hex dumps, the debugging cycle will stall. The `AetherTranspiler`'s `DEBUG_MODE` and symbol table generation are essential prerequisites for this.

## 7. Project Effort & Complexity Estimation

Implementing this LLM-Assisted Development Workflow involves significant architectural shifts, transforming the engine from a static framework into a dynamically generative meta-engine. The overall effort scales dramatically as we move from offline tooling to real-time generative physics.

### Development Workflow & Tooling (Medium Complexity)
*   **Tasks:** Building the Virtual File System (VFS) to restrict LLM access, creating the headless test-runner loop, implementing the Forth-to-AJS source-map translator, and building the automated retry/HITL loop.
*   **Effort:** Achievable in the near term. The `AetherTranspiler` already possesses `DEBUG_MODE` and symbol table generation, which form the necessary foundation.
*   **Risk:** Low-Medium. This phase primarily involves wrapping existing tools and managing LLM parsing logic.

### Dynamic Kernel Manifests & State Management (High Complexity)
*   **Tasks:** Refactoring `LevelConfig.ts` and the JS Host Star Topology router to support booting entirely new kernel variants on a room-by-room basis without dropping frames or corrupting global VSO memory. Managing the "Immutable Ledger" of past generations.
*   **Effort:** Significant. It requires deep modifications to the kernel lifecycle and how the VSO Registry maps memory across dynamically loaded Wasm instances.
*   **Risk:** High. Memory fragmentation and synchronization race conditions between the host and multiple dynamic guests are likely.

### The Narrative Evolution (Extreme Complexity)
*   **Tasks:** Implementing the phased narrative steps. While Step 1 (Offline Architect) and Step 2 (Horizon Forger) rely mostly on asynchronous scheduling and prompt chaining, Step 3 (Curated GM) and Step 4 (Autonomous GM) require near-instantaneous AJS generation mid-gameplay.
*   **Effort:** A long-term research endeavor. Achieving AJS generation and validation that strictly complies with historical VSO definitions in seconds pushes the boundaries of current LLM capabilities and context window limitations.
*   **Risk:** Extreme. Hallucinations or transpiler failures during real-time kernel generation in an active D&D session will immediately crash or corrupt the simulation for the player.

### Conclusion
The "AJS-Only Offline Developer" tooling and the **Offline World Architect (Step 1)** are highly practical and achievable goals that leverage Aethelgard's unique architecture for massive productivity gains. The evolution toward the **Autonomous D&D Game Master (Step 4)** should be treated as a multi-year, experimental feature requiring significant breakthroughs in LLM reliability, context management, and zero-latency transpilation.
