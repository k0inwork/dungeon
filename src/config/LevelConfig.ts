import { GRID_KERNEL_BLOCKS } from "../kernels/GridKernel";
import { HIVE_KERNEL_BLOCKS } from "../kernels/HiveKernel";
import { PLAYER_KERNEL_BLOCKS } from "../kernels/PlayerKernel";
import { BATTLE_KERNEL_BLOCKS } from "../kernels/BattleKernel";
import { PLATFORM_KERNEL_BLOCKS } from "../kernels/PlatformKernel";
import { KernelID } from "../types/Protocol";

export interface KernelConfig {
    role: KernelID;
    blocks: string[];
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
            { role: KernelID.PLAYER, blocks: PLAYER_KERNEL_BLOCKS },
            { role: KernelID.GRID, blocks: GRID_KERNEL_BLOCKS },
            { role: KernelID.HIVE, blocks: HIVE_KERNEL_BLOCKS },
            { role: KernelID.BATTLE, blocks: BATTLE_KERNEL_BLOCKS }
        ]
    },
    "PLATFORM": {
        mode: "PLATFORM",
        physicsRole: KernelID.PLATFORM,
        requiredKernels: [
            { role: KernelID.PLAYER, blocks: PLAYER_KERNEL_BLOCKS },
            { role: KernelID.PLATFORM, blocks: PLATFORM_KERNEL_BLOCKS },
            { role: KernelID.HIVE, blocks: HIVE_KERNEL_BLOCKS },
            { role: KernelID.BATTLE, blocks: BATTLE_KERNEL_BLOCKS }
        ]
    }
};
