
import { expect, test, describe, beforeAll } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { IntegrationSimulator } from './IntegrationSimulator';
import { GRID_KERNEL_BLOCKS } from '../kernels/GridKernel';
import { HIVE_KERNEL_BLOCKS } from '../kernels/HiveKernel';
import { BATTLE_KERNEL_BLOCKS } from '../kernels/BattleKernel';
import { PLAYER_KERNEL_BLOCKS } from '../kernels/PlayerKernel';
import { KernelID } from '../types/Protocol';

describe('Integration: Rat Chase', () => {
  let sim: IntegrationSimulator;
  let grid: KernelTestRunner;
  let hive: KernelTestRunner;
  let battle: KernelTestRunner;

  beforeAll(async () => {
    sim = new IntegrationSimulator();

    grid = new KernelTestRunner('GRID', KernelID.GRID);
    await grid.boot(GRID_KERNEL_BLOCKS);
    sim.addKernel(KernelID.GRID, 'GRID', grid);

    hive = new KernelTestRunner('HIVE', KernelID.HIVE);
    await hive.boot(HIVE_KERNEL_BLOCKS);
    sim.addKernel(KernelID.HIVE, 'HIVE', hive);

    battle = new KernelTestRunner('BATTLE', KernelID.BATTLE);
    await battle.boot(BATTLE_KERNEL_BLOCKS);
    sim.addKernel(KernelID.BATTLE, 'BATTLE', battle);

    // Initialize Kernels
    grid.run('INIT_MAP');
    hive.run('INIT_HIVE');
  });

  test('Aggressive NPC moves towards player', () => {
    // 1. Spawn Player at 10,10
    grid.run('10 10 65535 64 0 SPAWN_ENTITY');

    // 2. Spawn Aggressive Rat at 12,10 (Distance 2)
    // type 2 = Aggressive
    grid.run('12 10 16711680 114 2 SPAWN_ENTITY');

    // Initial Ticks to sync spawn events
    sim.tick();
    sim.tick();

    // Verify Rat position in Hive
    hive.run('1 HIVE_ENTITY OFF_X + @ 12 JS_ASSERT');

    // 3. Perform several ticks
    console.log("Starting Simulation Ticks...");
    for(let i=0; i<5; i++) {
        sim.tick();
        // Check Rat position in Grid memory
        // It should be moving West (towards 10,10)
    }

    // Rat was at 12,10. Player at 10,10.
    // Rat should have moved at least one step West.
    // 12 -> 11 or 10.
    grid.run('1 GET_ENT_PTR OFF_X + @ 12 < 1 JS_ASSERT');
  });
});
