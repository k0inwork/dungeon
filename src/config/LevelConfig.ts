import { GRID_KERNEL_BLOCKS } from "../kernels/GridKernel";
import { GRID_HIVE_KERNEL_BLOCKS } from "../kernels/GridHiveKernel";
import { PLAYER_KERNEL_BLOCKS } from "../kernels/PlayerKernel";
import { GRID_BATTLE_KERNEL_BLOCKS } from "../kernels/GridBattleKernel";
import { PLATFORM_BATTLE_KERNEL_BLOCKS } from "../kernels/PlatformBattleKernel";
import { PLATFORM_HIVE_KERNEL_BLOCKS } from "../kernels/PlatformHiveKernel";
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
            { role: KernelID.GRID_HIVE, blocks: GRID_HIVE_KERNEL_BLOCKS },
            { role: KernelID.GRID_BATTLE, blocks: GRID_BATTLE_KERNEL_BLOCKS }
        ]
    },
    "PLATFORM": {
        mode: "PLATFORM",
        physicsRole: KernelID.PLATFORM,
        requiredKernels: [
            { role: KernelID.PLAYER, blocks: PLAYER_KERNEL_BLOCKS },
            { role: KernelID.PLATFORM, blocks: PLATFORM_KERNEL_BLOCKS },
            { role: KernelID.PLATFORM_HIVE, blocks: PLATFORM_HIVE_KERNEL_BLOCKS },
            { role: KernelID.PLATFORM_BATTLE, blocks: PLATFORM_BATTLE_KERNEL_BLOCKS }
        ]
    }
};
