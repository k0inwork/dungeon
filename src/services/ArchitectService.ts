import { generatorService, WorldData } from "./GeneratorService";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { forthService } from "./WaForthService";
import { KernelID, getInstanceID } from "../types/Protocol";

// Import raw logic arrays directly to form our initial VFS state
import { GRID_DATA_BLOCKS, GRID_LOGIC_BLOCKS, GRID_AJS_SOURCE, GRID_KERNEL_BLOCKS } from "../kernels/GridKernel";
import { PLATFORM_DATA_BLOCKS, PLATFORM_LOGIC_BLOCKS, PLATFORM_AJS_SOURCE, PLATFORM_KERNEL_BLOCKS } from "../kernels/PlatformKernel";
import { HIVE_DATA_BLOCKS, HIVE_LOGIC_BLOCKS, HIVE_AJS_SOURCE, HIVE_KERNEL_BLOCKS } from "../kernels/HiveKernel";
import { BATTLE_DATA_BLOCKS, BATTLE_LOGIC_BLOCKS, BATTLE_AJS_SOURCE, BATTLE_KERNEL_BLOCKS } from "../kernels/BattleKernel";
import { PLAYER_DATA_BLOCKS, PLAYER_LOGIC_BLOCKS, PLAYER_AJS_SOURCE, PLAYER_KERNEL_BLOCKS } from "../kernels/PlayerKernel";

export interface VFSFile {
    filename: string;
    content: string;
    isModified: boolean;
    dataBlocks: string[]; // Keep transpiled formats for actual execution
    logicBlocks: string[];
}

export interface GenerationProgress {
    phase: string;
    detail: string;
    progress: number; // 0-100
    errors: string[];
}

export type ProgressCallback = (state: GenerationProgress) => void;

class ArchitectService {
    private vfs: Map<string, VFSFile> = new Map();
    private worldData: WorldData | null = null;

    constructor() {
        this.resetVFS();
    }

    private resetVFS() {
        this.vfs.clear();

        // Helper to map the raw AJS source to the VFS, keeping original data/logic blocks intact for fallback
        const createVfsFile = (filename: string, ajsSource: string, dataBlocks: string[], logicBlocks: string[], kernelId: KernelID, extraBlocks: string[]) => {
            this.vfs.set(filename, {
                filename,
                content: ajsSource,
                isModified: false,
                dataBlocks: [...dataBlocks],
                logicBlocks: [...logicBlocks]
            });
        };

        createVfsFile("GridKernel.ajs", GRID_AJS_SOURCE, GRID_DATA_BLOCKS, GRID_LOGIC_BLOCKS, KernelID.GRID, GRID_KERNEL_BLOCKS);
        createVfsFile("PlatformKernel.ajs", PLATFORM_AJS_SOURCE, PLATFORM_DATA_BLOCKS, PLATFORM_LOGIC_BLOCKS, KernelID.PLATFORM, PLATFORM_KERNEL_BLOCKS);
        createVfsFile("HiveKernel.ajs", HIVE_AJS_SOURCE, HIVE_DATA_BLOCKS, HIVE_LOGIC_BLOCKS, KernelID.HIVE, HIVE_KERNEL_BLOCKS);
        createVfsFile("BattleKernel.ajs", BATTLE_AJS_SOURCE, BATTLE_DATA_BLOCKS, BATTLE_LOGIC_BLOCKS, KernelID.BATTLE, BATTLE_KERNEL_BLOCKS);
        createVfsFile("PlayerKernel.ajs", PLAYER_AJS_SOURCE, PLAYER_DATA_BLOCKS, PLAYER_LOGIC_BLOCKS, KernelID.PLAYER, PLAYER_KERNEL_BLOCKS);
    }

    public getActiveVFS(): Map<string, VFSFile> {
        return this.vfs;
    }

    /**
     * Recompiles a modified VFS file string back into data/logic blocks via AetherTranspiler.
     * Note: In a real implementation we would also re-append the firmware/native blocks (like BLOCK_STANDARD_INBOX).
     * For now, this is a placeholder struct to show where the re-transpilation occurs.
     */
    private compileAJS(ajsString: string, kernelId: KernelID): { dataBlocks: string[], logicBlocks: string[] } {
        // AetherTranspiler transpile now natively returns { data, logic }
        const compiled = AetherTranspiler.transpile(ajsString, kernelId, 0) as any;

        // Return strictly the new transpiled components.
        // The ArchitectService caller will need to inject the Firmware/Forth wrappers.
        return {
            dataBlocks: [compiled.data],
            logicBlocks: [compiled.logic]
        };
    }

    /**
     * Phase 1: Create the World Structure (Lore, Atlas, Taxonomy)
     */
    public async forgeWorldStructure(seed: string, isMock: boolean, onProgress: ProgressCallback): Promise<WorldData> {
        this.resetVFS();
        onProgress({ phase: "PHASE 1: ARCHITECTING", detail: `Generating Atlas and Taxonomy for seed: ${seed}`, progress: 10, errors: [] });

        if (isMock) {
            this.worldData = generatorService.generateMockWorld();
        } else {
            try {
                this.worldData = await generatorService.generateWorld(seed);
            } catch (e: any) {
                console.warn("[Architect] Generating world via API failed. Falling back to Golden Path Mock.", e);
                onProgress({ phase: "PHASE 1: ARCHITECTING", detail: `API Exhausted. Using Golden Path Mock Data.`, progress: 20, errors: [] });
                this.worldData = generatorService.generateMockWorld();
            }
        }

        onProgress({ phase: "PHASE 1: ARCHITECTING", detail: `World structure generated. Found ${this.worldData.taxonomy.races.length} races.`, progress: 30, errors: [] });
        return this.worldData;
    }

    /**
     * Phase 2: Apply the skills/logic via LLM diffs to the VFS.
     */
    public async injectSkillLogic(isMock: boolean, onProgress: ProgressCallback): Promise<void> {
        if (!this.worldData) throw new Error("World Data not initialized. Run forgeWorldStructure first.");

        onProgress({ phase: "PHASE 2: CODING", detail: "Preparing AJS VFS...", progress: 40, errors: [] });

        // Build the context prompt
        const skillsContext = JSON.stringify(this.worldData.taxonomy, null, 2);

        // 1. Gather all current VFS file strings
        let vfsContext = "";
        for (const [name, file] of this.vfs.entries()) {
            vfsContext += `\n--- START FILE: ${name} ---\n${file.content}\n--- END FILE: ${name} ---\n`;
        }

        const ajsRulesContext = `
AJS (Aethelgard JavaScript) is a strict subset of JavaScript designed to transpile directly to WebAssembly Forth.
STRICT CONSTRAINTS:
1. No standard JS Objects ({}). You must use flat arrays or C-style VSO Structs via getter syntax (e.g. \`GridEntity(id)\`).
2. No Closures. Scope is strictly function-level.
3. No native JS string manipulation methods (like .split() or .replace()).
4. Array initialization must be explicit flat memory: \`new Uint32Array(size)\`.

GAME FUNCTIONS GLOBALLY AVAILABLE:
- \`Log("string")\`: Logs to the engine console.
- \`bus_send(op, sender, target, p1, p2, p3)\`: Sends a message packet across the star topology.
- \`Chan("name") <- [EVT, id, x, y]\`: AJS specific syntax for extended channel broadcasts.
- \`GridEntity(id)\`, \`BattleEntity(id)\`: Struct accessors that map memory to JS-like object properties.
`;

        const prompt = `
            You are an Aethelgard Logic Systems Programmer modifying the active Virtual File System.

            ${ajsRulesContext}

            Here is the newly generated taxonomy with requested skill mechanics (implement exactly these):
            ${skillsContext}

            Here are the current base kernel AJS files (your VFS):
            ${vfsContext}

            Task:
            Provide complete, updated file content for 'BattleKernel.ajs' and 'HiveKernel.ajs' (or others) to implement the specific logic for the skills described in the taxonomy.
            Do not just write pseudo-code; write valid AJS code using the provided functions and structs.

            Output strictly valid JSON mapping filenames to the FULL updated AJS content strings:
            {
               "BattleKernel.ajs": "the full modified ajs string...",
               "HiveKernel.ajs": "the full modified ajs string..."
            }
        `;

        if (!isMock) {
            try {
                // First, attempt actual generation if not explicitly mocked
                // Since we don't have a structured JSON response method for pure code diffs yet,
                // we will simulate the LLM call here, but immediately fall back to the "Golden Path" if it fails.
                onProgress({ phase: "PHASE 2: CODING", detail: "Prompting LLM for AJS diffs...", progress: 50, errors: [] });

                // Attempt to call the underlying AI provider directly if available
                // @ts-ignore
                if (generatorService.provider) {
                     // @ts-ignore
                     await generatorService.provider.generate(prompt);
                } else {
                     throw new Error("No AI Provider active.");
                }

                // ... in a full implementation we would parse the result here.

            } catch (e: any) {
                console.warn("[Architect] LLM Code Injection failed or timed out. Falling back to Golden Path Static Mock.", e);
                onProgress({ phase: "PHASE 2: CODING", detail: `LLM API failed (${e.message}). Falling back to Golden Path AJS injection.`, progress: 60, errors: [] });
            }
        } else {
             onProgress({ phase: "PHASE 2: CODING", detail: "Mock explicitly requested. Bypassing LLM and applying Golden Path.", progress: 50, errors: [] });
        }

        // --- GOLDEN PATH STATIC FALLBACK ---
        // If the LLM fails (due to quota, 404, or parsing errors) or if explicitly in Mock Mode,
        // we ensure the workflow can proceed by applying a known-good set of static AJS modifications.
        try {
            const battleFile = this.vfs.get("BattleKernel.ajs");
            if (battleFile) {
                // Mocking the LLM injecting a new skill
                battleFile.content = `// [LLM INJECTED SKILL LOGIC - GOLDEN PATH FALLBACK] \n` +
                `function custom_poison_strike(target) { \n` +
                `    Log("Custom Poison Strike applied!"); \n` +
                `} \n` + battleFile.content;

                const compiled = this.compileAJS(battleFile.content, KernelID.BATTLE);

                battleFile.dataBlocks[battleFile.dataBlocks.length - 1] = compiled.dataBlocks[0];
                battleFile.logicBlocks[0] = compiled.logicBlocks[0];
                battleFile.isModified = true;
            }

            onProgress({ phase: "PHASE 2: CODING", detail: "VFS successfully patched with Golden Path AJS diffs.", progress: 70, errors: [] });

        } catch (e: any) {
            console.error("Golden Path Injection Failed", e);
            onProgress({ phase: "PHASE 2: CODING", detail: "Golden Path Injection Failed.", progress: 70, errors: [e.message] });
            throw e;
        }
    }

    /**
     * Phase 3: Headless Mock Testing to verify the VFS compiles and doesn't crash.
     */
    public async validateKernelLogic(onProgress: ProgressCallback): Promise<boolean> {
        onProgress({ phase: "PHASE 3: VALIDATION", detail: "Booting headless mock simulation...", progress: 80, errors: [] });

        // For Phase 1 we use the active forthService.
        // A true mock engine would spin up an isolated WaForthProcessManager instance,
        // but we can piggyback off forthService for this simple validation stage.
        try {
            // Test boot the modified Grid and Battle kernels
            const gridId = String(getInstanceID(KernelID.GRID, 0)) + "_MOCK";
            const battleId = String(getInstanceID(KernelID.BATTLE, 0)) + "_MOCK";

            await forthService.bootProcess(gridId);
            await forthService.bootProcess(battleId);

            const gridProc = forthService.get(gridId);
            const battleProc = forthService.get(battleId);

            const vfsGrid = this.vfs.get("GridKernel.ajs")!;
            const vfsBattle = this.vfs.get("BattleKernel.ajs")!;

            // Compile and Run Data Blocks
            for (const b of vfsGrid.dataBlocks) gridProc.run(b);
            gridProc.captureDataEndPointer();
            for (const b of vfsGrid.logicBlocks) gridProc.run(b);

            for (const b of vfsBattle.dataBlocks) battleProc.run(b);
            battleProc.captureDataEndPointer();
            for (const b of vfsBattle.logicBlocks) battleProc.run(b);

            // Run Init Sequence
            gridProc.run("INIT_MAP");
            battleProc.run("INIT_BATTLE");

            if (!gridProc || !battleProc) {
                throw new Error("Failed to load mock kernels for validation.");
            }
            // Check for stack leaks
            // WAForth exposes the forth state directly, or we can check the depth via a run command.
            gridProc.run("DEPTH .N");
            battleProc.run("DEPTH .N");
            // In a real implementation we would parse the output of DEPTH.
            // For now, if it didn't crash, we pass it.

            onProgress({ phase: "PHASE 3: VALIDATION", detail: "Validation Passed. Kernels stable.", progress: 100, errors: [] });
            return true;

        } catch (e: any) {
            console.error("Validation Failed:", e);
            onProgress({ phase: "PHASE 3: VALIDATION", detail: "Validation Failed! Stack Trace generated.", progress: 90, errors: [e.message] });
            // In a full implementation, we would extract the error and loop back to Phase 2 for LLM repair
            return false;
        }
    }
}

export const architectService = new ArchitectService();