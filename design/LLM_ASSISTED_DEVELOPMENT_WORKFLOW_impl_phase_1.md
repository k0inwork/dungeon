# Aethelgard: Implementation Phase 1 - Offline World Architect (Static Generation)

This document details the concrete implementation steps for achieving Phase 1 of the LLM-Assisted Development Workflow: **The Offline World Architect (Static Generation)**.

This phase shifts Aethelgard from using purely pre-compiled, static game logic to a generative pipeline where an AI (acting as the Architect) actively writes and compiles new physical and behavioral laws (AJS kernels) for a newly generated world prior to the player starting their session.

## 1. High-Level Pipeline

The pipeline is triggered during the boot sequence (`INITIATE GENERATION`) and consists of three distinct stages orchestrated by the new `ArchitectService`:

1.  **Stage 1: Manifold & Lore Generation (The "What")**
    *   The LLM generates the World Bible: Themes, Taxonomy (Races, Classes, Origins), and the Atlas (a graph of connected Manifolds/Levels).
    *   Crucially, the LLM only generates the *names* and *descriptions* of unique skills, mechanics, or traits (e.g., "Amphibious: Ignores swamp movement penalties"). It does **not** write any AJS code in this stage.
    *   The generated structures explicitly differentiate between the two core Manifold types: `GRID` (top-down event-driven) and `PLATFORM` (side-scrolling real-time).

2.  **Stage 2: AJS Code Injection via Virtual File System (The "How")**
    *   The system creates a **Virtual File System (VFS)** in memory.
    *   It extracts *only* the raw AJS source strings (data blocks and logic blocks) from the existing core kernels (`BattleKernel.ts`, `GridKernel.ts`, `PlatformKernel.ts`, `HiveKernel.ts`, `PlayerKernel.ts`).
    *   These isolated strings are presented to the LLM as distinct `.ajs` files within the VFS (e.g., `BattleKernel.ajs`, `PlatformKernel.ajs`). This prevents the LLM from hallucinating TypeScript interfaces, Vite configurations, or React components.
    *   The LLM is prompted with the Stage 1 Taxonomy and the VFS. It is tasked with providing **source code diffs** to these `.ajs` files to inject the logic required to implement the newly generated skills.
    *   The `ArchitectService` maps these diffs back into the VFS, updating the string representations of the kernels.

3.  **Stage 3: Mock Simulation, Testing & Boot (Verification)**
    *   The updated `.ajs` strings in the VFS are passed to the `AetherTranspiler`.
    *   The system boots a headless/background WAForth instance (a "Mock Engine") to load the new kernel logic.
    *   A simulated tick is executed. The system listens for transpiler AST errors, WAForth runtime exceptions (`EXEC ERROR`), or stack leaks (`[ASSERT_STACK]`).
    *   **Self-Repair Loop:** If an error is caught, the specific error trace and the offending `.ajs` file are fed back to the LLM for a repair diff. This loops up to $N$ times.
    *   **Human-in-the-Loop (HITL):** If the loop fails $N$ times, the generation pauses, and the raw diffs/errors are presented to the user for manual correction via the React UI.
    *   If successful, the running game engine boots the `active_level` using the newly generated VFS kernels instead of the default `LEVEL_CONFIGS`.

---

## 2. Technical Architecture

### 2.1 The Virtual File System (VFS)

The VFS is an in-memory representation of the Aethelgard Logic Tier.

```typescript
interface VirtualFile {
    filename: string;      // e.g., "BattleKernel.ajs"
    content: string;       // The raw AJS source code
    originalHash: string;  // For diff verification
}

class VirtualFileSystem {
    files: Map<string, VirtualFile>;

    // Loads the raw AJS strings exported from the .ts files
    mountBaseKernels(coreAJSStrings: Record<string, string>) { ... }

    // Applies a standard diff format provided by the LLM
    applyDiff(filename: string, diff: string) { ... }

    // Returns the current state of the AJS strings to feed the Transpiler
    exportKernels(): Record<string, string> { ... }
}
```

### 2.2 Extraction Strategy

Currently, AJS code is embedded inside `export const KERNEL_LOGIC_BLOCKS = [...]` arrays in `.ts` files. To cleanly provide this to the VFS, we will concatenate these string blocks into a single cohesive string representing the entire file content.

For example, `PlatformKernel.ts` contains `PLATFORM_DATA_BLOCKS` and `PLATFORM_LOGIC_BLOCKS`. The VFS will merge these into a single `PlatformKernel.ajs` string. When the VFS exports the modified code, the `AetherTranspiler` can ingest the monolithic string (it handles parsing internally).

### 2.3 LLM Prompting Strategy (Stage 2)

The LLM prompt must be highly constrained.

**System Prompt:**
> "You are an Aethelgard Logic Systems Programmer. You operate exclusively in Aethelgard JavaScript (AJS). You will receive a set of required skills and the current VFS containing `.ajs` files. You must return exact string replacement diffs to inject the logic for these skills into the appropriate kernels.
>
> AJS Constraints:
> - No standard JS objects (`{}`). Use VSO Struct arrays.
> - No closures.
> - Use provided globals (Source, Target)."

**Input Example:**
```json
{
  "requirements": [
    { "skill": "Venomous Strike", "type": "Race: Viper", "desc": "Attacks apply poison status." }
  ],
  "vfs": {
    "BattleKernel.ajs": "function resolve_damage() { ... } \n function apply_status() { ... }",
    "HiveKernel.ajs": "function evaluate_proposals() { ... }"
  }
}
```

### 2.4 The Mock Engine (Verification)

The `SimulationEngine` currently requires React state (`handleInspect`, `playerMoveRef`). We will abstract a `HeadlessSimulationEngine` (or `MockValidator`) that initializes `WaForthService` processes entirely in memory without UI hooks.

```typescript
class MockValidator {
    async validateVFS(vfs: VirtualFileSystem): Promise<{ success: boolean; error?: string }> {
        // 1. Transpile VFS contents
        // 2. forthService.bootProcess() for all kernels
        // 3. forthService.run() mock initialization blocks
        // 4. Send a mock BUS_SEND packet to simulate an event (e.g., REQ_MOVE or EVT_DAMAGE)
        // 5. Check forthService.getPacketLog() for crashes
        // 6. Return success or the specific stack trace.
    }
}
```

## 3. Implementation Steps

1.  **Refactor Exports:** Ensure all core kernels (`src/kernels/*.ts`) export a unified raw string (e.g., `RAW_GRID_AJS`) alongside the legacy block arrays to easily seed the VFS.
2.  **Create `ArchitectService.ts`:** Implement the VFS, the 3-stage generation pipeline, and the API calls to `GeneratorService`.
3.  **Implement Diff Parser:** Write a robust function in `ArchitectService` to safely parse and apply the LLM's suggested text replacements/diffs to the `.ajs` strings.
4.  **Create `MockValidator`:** Build the headless test harness to verify the transpiled AJS before pushing it to the live UI.
5.  **Update UI (`BootScreen.tsx` & `useGameSimulation.ts`):**
    *   Replace the simple `generateWorld()` call with `architectService.forgeWorld()`.
    *   Add multi-phase progress indicators to the `BootScreen`.
    *   Update `loadLevel()` to prioritize loading kernels from the active VFS instance rather than the hardcoded `LEVEL_CONFIGS` if a dynamic world was just generated.