import { GRID_DATA_BLOCKS, GRID_LOGIC_BLOCKS, GRID_KERNEL_BLOCKS } from "../kernels/GridKernel";
import { HIVE_DATA_BLOCKS, HIVE_LOGIC_BLOCKS, HIVE_KERNEL_BLOCKS } from "../kernels/HiveKernel";
import { PLAYER_DATA_BLOCKS, PLAYER_LOGIC_BLOCKS, PLAYER_KERNEL_BLOCKS } from "../kernels/PlayerKernel";
import { BATTLE_DATA_BLOCKS, BATTLE_LOGIC_BLOCKS, BATTLE_KERNEL_BLOCKS } from "../kernels/BattleKernel";
import { PLATFORM_DATA_BLOCKS, PLATFORM_LOGIC_BLOCKS, PLATFORM_KERNEL_BLOCKS } from "../kernels/PlatformKernel";
import { KernelID } from "../types/Protocol";

export interface KernelConfig {
    role: KernelID;
    blocks: string[]; // Keep for legacy/tests, but we will mostly use data/logic
    dataBlocks: string[];
    logicBlocks: string[];
}

export interface LevelSimulationConfig {
    mode: "GRID" | "PLATFORM";
    physicsRole: KernelID;
    requiredKernels: KernelConfig[];
}

export const LEVEL_CONFIGS: Record<string, LevelSimulationConfig> = {
    "GRID": {
        mode: "GRID",
        physicsRole: KernelID.GRID,
        requiredKernels: [
            { role: KernelID.PLAYER, blocks: PLAYER_KERNEL_BLOCKS, dataBlocks: PLAYER_DATA_BLOCKS, logicBlocks: PLAYER_LOGIC_BLOCKS },
            { role: KernelID.GRID, blocks: GRID_KERNEL_BLOCKS, dataBlocks: GRID_DATA_BLOCKS, logicBlocks: GRID_LOGIC_BLOCKS },
            { role: KernelID.HIVE, blocks: HIVE_KERNEL_BLOCKS, dataBlocks: HIVE_DATA_BLOCKS, logicBlocks: HIVE_LOGIC_BLOCKS },
            { role: KernelID.BATTLE, blocks: BATTLE_KERNEL_BLOCKS, dataBlocks: BATTLE_DATA_BLOCKS, logicBlocks: BATTLE_LOGIC_BLOCKS }
        ]
    },
    "PLATFORM": {
        mode: "PLATFORM",
        physicsRole: KernelID.PLATFORM,
        requiredKernels: [
            { role: KernelID.PLAYER, blocks: PLAYER_KERNEL_BLOCKS, dataBlocks: PLAYER_DATA_BLOCKS, logicBlocks: PLAYER_LOGIC_BLOCKS },
            { role: KernelID.PLATFORM, blocks: PLATFORM_KERNEL_BLOCKS, dataBlocks: PLATFORM_DATA_BLOCKS, logicBlocks: PLATFORM_LOGIC_BLOCKS },
            { role: KernelID.HIVE, blocks: HIVE_KERNEL_BLOCKS, dataBlocks: HIVE_DATA_BLOCKS, logicBlocks: HIVE_LOGIC_BLOCKS },
            { role: KernelID.BATTLE, blocks: BATTLE_KERNEL_BLOCKS, dataBlocks: BATTLE_DATA_BLOCKS, logicBlocks: BATTLE_LOGIC_BLOCKS }
        ]
    }
};
