import { HIVE_KERNEL_BLOCKS } from './src/kernels/HiveKernel';
import { BATTLE_KERNEL_BLOCKS } from './src/kernels/BattleKernel';

console.log("--- HIVE BLOCKS ---");
HIVE_KERNEL_BLOCKS.forEach((b, i) => console.log(`BLOCK ${i}:\n`, b));

console.log("--- BATTLE BLOCKS ---");
BATTLE_KERNEL_BLOCKS.forEach((b, i) => console.log(`BLOCK ${i}:\n`, b));
