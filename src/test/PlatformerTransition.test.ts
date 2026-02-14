
import { describe, it, expect } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { PLATFORM_KERNEL_BLOCKS } from '../kernels/PlatformKernel';
import { KernelID } from '../types/Protocol';

describe('Platformer Transition', () => {
  it('should trigger EVT_LEVEL_TRANSITION when player reaches a gate', async () => {
    const runner = new KernelTestRunner('PLATFORM', KernelID.PLATFORM);
    await runner.boot(PLATFORM_KERNEL_BLOCKS);

    // Initialize platformer on level 2 (which has a gate)
    runner.proc.run('2 INIT_PLATFORMER');

    // Set player position near the gate 'E' (Char 69)
    // In Level 2, 'E' is at (38, 14)
    // 38 * 65536 = 2490368
    // 14 * 65536 = 917504
    runner.proc.run('2490368 PLAYER_X !');
    runner.proc.run('917504 PLAYER_Y !');

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
