
import { expect, test, describe, beforeAll } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { KernelID, Opcode } from '../types/Protocol';
import { PLATFORM_KERNEL_BLOCKS } from '../kernels/PlatformKernel';

describe('Platformer Level Transition', () => {
  test('Sends EVT_LEVEL_TRANSITION when reaching win area', async () => {
    const runner = new KernelTestRunner('PLATFORM', KernelID.PLATFORM);
    await runner.boot(PLATFORM_KERNEL_BLOCKS);

    // Initial state
    runner.run('INIT_PLATFORMER');

    // Set 'E' (69) to transition to target 5
    runner.run('69 5 SET_TRANSITION');
    // Load tile 'E' at 2, 18
    runner.run('2 18 0 69 0 LOAD_TILE');

    // Move player to 2, 18
    runner.run('2 65536 * PLAYER_X !');
    runner.run('18 65536 * PLAYER_Y !');

    // Run cycle
    runner.run('RUN_PLATFORM_CYCLE');

    // Check Outbox for EVT_LEVEL_TRANSITION (207)
    // Packet: [207, K_PLATFORM, K_HOST, 0, 0, 0]
    const outMem = new Int32Array(runner.getMemory(), 0x10400, 1024);
    const count = outMem[0];
    expect(count).toBeGreaterThanOrEqual(6);

    let foundTransition = false;
    for (let i = 1; i <= count; i += 6) {
        if (outMem[i] === Opcode.EVT_LEVEL_TRANSITION) {
            foundTransition = true;
            expect(outMem[i+2]).toBe(KernelID.HOST);
            expect(outMem[i+3]).toBe(5); // Target level 5
        }
    }
    expect(foundTransition).toBe(true);
  });
});
