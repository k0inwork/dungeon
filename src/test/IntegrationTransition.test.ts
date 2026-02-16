
import { expect, test } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';
import { GRID_AJS_SOURCE } from '../kernels/GridKernel';
import { KernelID, Opcode } from '../types/Protocol';
import { KernelTestRunner } from './KernelRunner';

test('Integration: Player move triggers transition event', async () => {
    const runner = new KernelTestRunner('GRID', KernelID.GRID);
    const { STANDARD_KERNEL_FIRMWARE } = await import('../kernels/SharedBlocks');

    AetherTranspiler.reset();
    await runner.boot([
        ...STANDARD_KERNEL_FIRMWARE,
        AetherTranspiler.transpile(GRID_AJS_SOURCE, KernelID.GRID),
        ': RUN_GRID_CYCLE PROCESS_INBOX ;'
    ]);

    // 1. Setup World
    runner.run('INIT_MAP');
    runner.run('82 1 SET_TRANSITION'); // 'R' -> index 1
    runner.run('10 10 0 82 0 LOAD_TILE'); // 'R' at 10, 10
    runner.run('9 10 0 64 0 SPAWN_ENTITY'); // Player at 9, 10

    // 2. Simulate Move Request
    // Header: [OP, SENDER, TARGET, P1, P2, P3]
    runner.run('6 INPUT_QUEUE !');
    runner.run(`${Opcode.REQ_MOVE} INPUT_QUEUE 4 + !`);
    runner.run(`${KernelID.PLAYER} INPUT_QUEUE 8 + !`);
    runner.run(`${KernelID.GRID} INPUT_QUEUE 12 + !`);
    runner.run(`0 INPUT_QUEUE 16 + !`); // ID 0
    runner.run(`1 INPUT_QUEUE 20 + !`); // DX 1
    runner.run(`0 INPUT_QUEUE 24 + !`); // DY 0

    // 3. Process - DIAGNOSTICS
    runner.run('INPUT_QUEUE @ .');
    console.log("Input Queue Count:", runner.proc.forth.pop());

    runner.run('10 10 CALC_IDX .');
    const ti = runner.proc.forth.pop();
    console.log("TI for 10,10:", ti);

    runner.run(`TERRAIN_MAP ${ti} CELLS + @ .`);
    console.log("Terrain at TI:", runner.proc.forth.pop());

    runner.run('82 CELLS TRANSITION_MAP + @ .');
    console.log("Transition for 82:", runner.proc.forth.pop());

    runner.run('589824 @ .');
    console.log("Player Char at 0x90000:", runner.proc.forth.pop());

    runner.run('ENTITY_COUNT @ .');
    console.log("Entity Count:", runner.proc.forth.pop());

    runner.run('PROCESS_INBOX');
    console.log("Kernel Logs:", runner.proc.outputLog.join('\n'));

    // 4. Check Output
    runner.run('OUTPUT_QUEUE @');
    const count = runner.proc.forth.pop();
    expect(count).toBe(6);

    runner.run('OUTPUT_QUEUE 4 + @');
    const op = runner.proc.forth.pop();
    expect(op).toBe(Opcode.EVT_LEVEL_TRANSITION);

    runner.run('OUTPUT_QUEUE 4 + 12 + @');
    const levelIdx = runner.proc.forth.pop();
    expect(levelIdx).toBe(1);
});
