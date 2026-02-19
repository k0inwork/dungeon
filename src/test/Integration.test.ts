
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

    // Process SUB packets generated during boot/init
    sim.tick();
  });

  test('Aggressive NPC moves towards player', () => {
    // 1. Spawn Player at 10,10
    grid.run('10 10 65535 64 0 SPAWN_ENTITY');

    // 2. Spawn Aggressive Rat at 15,10 (Distance 5)
    // type 2 = Aggressive
    grid.run('15 10 16711680 114 2 SPAWN_ENTITY');

    console.log(`Entities spawned. Grid Entity Count: ${grid.run('ENTITY_COUNT @ .N')}`);

    // 3. Perform ticks
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}-${now.getMinutes().toString().padStart(2,'0')}-${now.getSeconds().toString().padStart(2,'0')}`;
    const artifactDir = `./test-results/run_${timestamp}`;
    if (!fs.existsSync('./test-results')) fs.mkdirSync('./test-results');
    fs.mkdirSync(artifactDir);

    const logPath = `${artifactDir}/simulation_trace.txt`;
    const summaryPath = `${artifactDir}/simulation_summary.json`;

    let logOutput = "[INTEGRATION TEST] Starting Rat Chase Simulation...\n";
    logOutput += `Timestamp: ${now.toLocaleString()}\n`;
    logOutput += "TICK | PLAYER POS | RAT POS          | EVENTS\n";
    logOutput += "------------------------------------------------------------\n";

    console.log("\n" + logOutput.trim());

    const trace: any[] = [];

    for(let i=0; i<20; i++) {
        const gridMem = new DataView(grid.getMemory());

        const getVal = (id: number, offset: number) => {
            const base = 0x90000 + (id * 20); // GridEntity size 20
            return gridMem.getInt32(base + offset, true);
        };

        const px = getVal(0, 12); // OFF_X
        const py = getVal(0, 8);  // OFF_Y
        const rx = getVal(1, 12);
        const ry = getVal(1, 8);

        const events = sim.busLog.join(" | ");
        sim.busLog = []; // Clear for next tick

        const line = `${i.toString().padEnd(4)} | ${px},${py.toString().padEnd(2)}     | ${rx.toString().padEnd(2)},${ry.toString().padEnd(2)}        | ${events}`;
        console.log(line);
        logOutput += line + "\n";

        trace.push({ tick: i, player: {x: px, y: py}, rat: {x: rx, y: ry}, events });

        sim.tick();
    }

    const gridMem = new DataView(grid.getMemory());
    const finalX = gridMem.getInt32(0x90000 + (1 * 20) + 12, true);
    const finalY = gridMem.getInt32(0x90000 + (1 * 20) + 8, true);

    const footer = "----------------------------\n" + `Simulation Ended. Final Rat: ${finalX},${finalY}\n`;
    console.log(footer.trim());
    logOutput += footer;

    // Save Trace TXT
    fs.writeFileSync(logPath, logOutput);

    // Save Summary JSON
    const summary = {
        test_name: "Rat Chase",
        timestamp: now.toISOString(),
        ticks: 10,
        final_state: {
            player: {x: 10, y: 10},
            rat: {x: finalX, y: finalY}
        },
        success: finalX < 12,
        trace
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`Artifacts saved to ${artifactDir}`);

    // Rat was at 15,10. Player at 10,10.
    // Rat should have moved closer to the player.
    expect(finalX).toBeLessThan(15);
  });
});
