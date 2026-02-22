
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
    // Check initial position (2, 2 in fixed point)
    runner.proc.run('PLAYER_X 131072 JS_ASSERT');
    runner.proc.run('PLAYER_Y 131072 JS_ASSERT');
  });

  test('Gravity and Collision', () => {
    // Set a block below the player (at y=3)
    runner.proc.run('2 3 0 35 1 LOAD_TILE');

    // Run physics cycle multiple times
    for(let i=0; i<10; i++) {
        runner.proc.run('UPDATE_PHYSICS');
    }

    // Player should have landed on top of the block at y=2
    runner.proc.run('PLAYER_Y 131072 JS_ASSERT');
    runner.proc.run('PLAYER_VY 0 JS_ASSERT');
  });

  test('Jump Mechanics', () => {
    // Ensure on ground
    runner.proc.run('2 3 0 35 1 LOAD_TILE');
    runner.proc.run('UPDATE_PHYSICS');

    runner.proc.run('CMD_JUMP');
    // VY should be jump_force (-75000)
    runner.proc.run('PLAYER_VY 75000 NEGATE JS_ASSERT');
  });

  test('Horizontal Movement', () => {
    runner.proc.run('INIT_PLATFORMER');
    runner.proc.run('1 CMD_MOVE'); // Move Right
    runner.proc.run('UPDATE_PHYSICS');

    // VX should be move_speed (20000) * friction_factor
    // Friction is (vx * 8) / 10. So 20000 * 8 / 10 = 16000
    runner.proc.run('PLAYER_VX 16000 JS_ASSERT');
  });

  test('Win Condition (Bottom-Left)', () => {
    runner.proc.run('INIT_PLATFORMER');
    // Set level to 1 (P1)
    runner.proc.run('1 SET_LEVEL_ID');

    runner.proc.run('1 18 0 62 0 LOAD_TILE');

    // Use CMD_TELEPORT instead of manual memory write for tests now
    runner.proc.run('1 18 CMD_TELEPORT');
    runner.proc.run('UPDATE_PHYSICS');

    // Should have reset to 5,Y (reset pos) and sent transition
    runner.proc.run('PLAYER_X 327680 JS_ASSERT');
  });
});
