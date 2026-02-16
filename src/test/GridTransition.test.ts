
import { expect, test, beforeEach } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';
import { GRID_AJS_SOURCE } from '../kernels/GridKernel';
import { KernelID, Opcode } from '../types/Protocol';
import { KernelTestRunner } from './KernelRunner';

test('GridKernel triggers transition', async () => {
    const runner = new KernelTestRunner('GRID', KernelID.GRID);
    const { STANDARD_KERNEL_FIRMWARE } = await import('../kernels/SharedBlocks');
    await runner.boot([
        ...STANDARD_KERNEL_FIRMWARE,
        AetherTranspiler.transpile(GRID_AJS_SOURCE, KernelID.GRID),
        ': RUN_GRID_CYCLE PROCESS_INBOX ;'
    ]);

    // Initialize map
    runner.run('INIT_MAP');

    // Set transition for 'R' (82) to level index 1
    runner.run('82 1 SET_TRANSITION');

    // Load 'R' at 10, 10
    // LOAD_TILE ( X Y COLOR CHAR TYPE -- )
    runner.run('10 10 0 82 0 LOAD_TILE');

    // Spawn player at 9, 10
    // SPAWN_ENTITY ( X Y COLOR CHAR TYPE -- )
    runner.run('9 10 0 64 0 SPAWN_ENTITY');

    // Move player right onto 'R'
    // Directly write to INPUT_QUEUE since we don't have a broker in this simple test
    // Packet: [REQ_MOVE, PLAYER, GRID, 0, 1, 0]
    runner.run(`6 INPUT_QUEUE !`);
    runner.run(`${Opcode.REQ_MOVE} INPUT_QUEUE 4 + !`);
    runner.run(`${KernelID.PLAYER} INPUT_QUEUE 8 + !`);
    runner.run(`${KernelID.GRID} INPUT_QUEUE 12 + !`);
    runner.run(`0 INPUT_QUEUE 16 + !`); // ID 0
    runner.run(`1 INPUT_QUEUE 20 + !`); // DX 1
    runner.run(`0 INPUT_QUEUE 24 + !`); // DY 0

    const out = runner.run('PROCESS_INBOX');
    console.log("Kernel Output:", out);

    // Check for EVT_LEVEL_TRANSITION (207) in output queue
    // Packets are 6 cells.
    // Count is at OUTPUT_QUEUE
    runner.run('OUTPUT_QUEUE @');
    const count = runner.proc.forth.pop();
    console.log("Output Queue Count:", count);

    expect(count).toBe(6);

    runner.run('OUTPUT_QUEUE 4 + @');
    const op = runner.proc.forth.pop();
    expect(op).toBe(Opcode.EVT_LEVEL_TRANSITION);

    runner.run('OUTPUT_QUEUE 4 + 12 + @'); // P1
    const levelIdx = runner.proc.forth.pop();
    expect(levelIdx).toBe(1);
});
