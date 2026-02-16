
import { describe, it, expect } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { PLATFORM_KERNEL_BLOCKS } from '../kernels/PlatformKernel';
import { KernelID } from '../types/Protocol';

describe('Platformer Transition', () => {
  it('should trigger EVT_LEVEL_TRANSITION when player reaches a gate', async () => {
    const runner = new KernelTestRunner('PLATFORM', KernelID.PLATFORM);
    await runner.boot(PLATFORM_KERNEL_BLOCKS);

    // Initialize platformer
    runner.proc.run('INIT_PLATFORMER');

    // Set up a gate 'E' (69) at (38, 14) that leads to level 0 (Hub)
    runner.proc.run('69 0 SET_TRANSITION');
    runner.proc.run('38 14 0 69 0 LOAD_TILE');

    // Set player position near the gate 'E'
    runner.proc.run('2490368 PLAYER_X !'); // 38 * 65536
    runner.proc.run('917504 PLAYER_Y !');  // 14 * 65536

    // Wait for the transition event to be sent
    const outMem = new Int32Array(runner.getMemory(), 0x10400, 1024);

    // Tick simulation multiple times
    for (let i = 0; i < 50; i++) {
        runner.proc.run('RUN_PLATFORM_CYCLE');
    }

    console.log("[TEST] OUT_COUNT at 0x10400:", outMem[0]);

    // Check OUT_PTR variable directly via Forth
    runner.proc.run('OUT_PTR @ .');

    expect(outMem[0]).toBeGreaterThanOrEqual(6);
  });
});
