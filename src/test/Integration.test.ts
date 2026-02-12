
import { expect, test, describe, beforeAll } from 'vitest';
import * as fs from 'fs';
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

    console.log(`Entities spawned. Grid Entity Count: ${grid.run('ENTITY_COUNT @ .N')}`);

    // Initial Ticks to sync spawn events
    // We need at least 2 ticks for: GRID sends -> SIM routes -> HIVE processes
    sim.tick();
    sim.tick();
    sim.tick();

    // 3. Perform several ticks
    const logPath = './integration_test.log';
    let logOutput = "[INTEGRATION TEST] Starting Rat Chase Simulation...\n";
    logOutput += "TICK | PLAYER POS | RAT POS\n";
    logOutput += "----------------------------\n";

    console.log("\n" + logOutput.trim());

    for(let i=0; i<10; i++) {
        // We use JS_ASSERT with a dummy value to see if it fails,
        // but actually we just want to log.
        // Let's use a simpler way: write to memory and read memory from JS.
        const gridMem = new DataView(grid.getMemory());

        const getVal = (id: number, offset: number) => {
            const base = 0x90000 + (id * 20); // GridEntity size 20
            return gridMem.getInt32(base + offset, true);
        };

        const px = getVal(0, 12); // OFF_X
        const py = getVal(0, 8);  // OFF_Y
        const rx = getVal(1, 12);
        const ry = getVal(1, 8);

        const line = `${i.toString().padEnd(4)} | ${px},${py.toString().padEnd(2)}     | ${rx},${ry}`;
        console.log(line);
        logOutput += line + "\n";

        sim.tick();
    }

    const gridMem = new DataView(grid.getMemory());
    const finalX = gridMem.getInt32(0x90000 + (1 * 20) + 12, true);

    const footer = "----------------------------\n" + `Simulation Ended. Final Rat X: ${finalX}\n`;
    console.log(footer.trim());
    logOutput += footer;

    fs.writeFileSync(logPath, logOutput);
    console.log(`Log saved to ${logPath}`);

    // Rat was at 12,10. Player at 10,10.
    // Rat should have moved closer to the player.
    expect(finalX).toBeLessThan(12);
  });
});
