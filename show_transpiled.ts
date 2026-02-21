import { HIVE_KERNEL_BLOCKS } from './src/kernels/HiveKernel.ts';
import { BATTLE_KERNEL_BLOCKS } from './src/kernels/BattleKernel.ts';
import { GRID_KERNEL_BLOCKS } from './src/kernels/GridKernel.ts';

console.log("--- GRID BLOCKS ---");
GRID_KERNEL_BLOCKS.forEach((b, i) => console.log(`BLOCK ${i}:\n`, b));

console.log("--- HIVE BLOCKS ---");
HIVE_KERNEL_BLOCKS.forEach((b, i) => console.log(`BLOCK ${i}:\n`, b));

console.log("--- BATTLE BLOCKS ---");
BATTLE_KERNEL_BLOCKS.forEach((b, i) => console.log(`BLOCK ${i}:\n`, b));
