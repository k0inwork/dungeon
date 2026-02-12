
import { expect, test, describe, beforeAll } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { PLATFORM_KERNEL_BLOCKS } from '../kernels/PlatformKernel';
import { KernelID } from '../types/Protocol';

describe('PlatformKernel Logic Tests', () => {
  let runner: KernelTestRunner;

  beforeAll(async () => {
    runner = new KernelTestRunner('PLATFORM', KernelID.PLATFORM);
    await runner.boot(PLATFORM_KERNEL_BLOCKS);
  });

  test('Physics Initialization', () => {
    runner.proc.run('INIT_PLATFORMER');
    // Check initial position (2, 10 in fixed point)
    runner.proc.run('PLAYER_X @ 131072 JS_ASSERT');
    runner.proc.run('PLAYER_Y @ 655360 JS_ASSERT');
  });

  test('Gravity and Collision', () => {
    // Set a block below the player (at y=11)
    runner.proc.run('2 11 0 35 1 LOAD_TILE');

    // Run physics cycle multiple times
    for(let i=0; i<10; i++) {
        runner.proc.run('UPDATE_PHYSICS');
    }

    // Player should have landed on top of the block at y=10
    runner.proc.run('PLAYER_Y @ 655360 JS_ASSERT');
    runner.proc.run('PLAYER_VY @ 0 JS_ASSERT');
  });

  test('Jump Mechanics', () => {
    // Ensure on ground
    runner.proc.run('2 11 0 35 1 LOAD_TILE');
    runner.proc.run('UPDATE_PHYSICS');

    runner.proc.run('CMD_JUMP');
    // VY should be jump_force (-60000)
    runner.proc.run('PLAYER_VY @ 60000 NEGATE JS_ASSERT');
  });

  test('Horizontal Movement', () => {
    runner.proc.run('INIT_PLATFORMER');
    runner.proc.run('1 CMD_MOVE'); // Move Right
    runner.proc.run('UPDATE_PHYSICS');

    // VX should be move_speed (5000) * friction_factor
    // Friction is (vx * 4) / 5. So 5000 * 4 / 5 = 4000
    runner.proc.run('PLAYER_VX @ 4000 JS_ASSERT');
  });
});
