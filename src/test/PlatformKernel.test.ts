
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
    runner.proc.run('PLAYER_X @ 131072 JS_ASSERT');
    runner.proc.run('PLAYER_Y @ 131072 JS_ASSERT');
  });

  test('Gravity and Collision', () => {
    // Set a block below the player (at y=3)
    runner.proc.run('2 3 0 35 1 LOAD_TILE');

    // Run physics cycle multiple times
    for(let i=0; i<10; i++) {
        runner.proc.run('UPDATE_PHYSICS');
    }

    // Player should have landed on top of the block at y=2
    runner.proc.run('PLAYER_Y @ 131072 JS_ASSERT');
    runner.proc.run('PLAYER_VY @ 0 JS_ASSERT');
  });

  test('Jump Mechanics', () => {
    // Ensure on ground
    runner.proc.run('2 3 0 35 1 LOAD_TILE');
    runner.proc.run('UPDATE_PHYSICS');

    runner.proc.run('CMD_JUMP');
    // VY should be jump_force (-75000)
    runner.proc.run('PLAYER_VY @ 75000 NEGATE JS_ASSERT');
  });

  test('Forth Math Test', () => {
    runner.proc.run('20000 8 * 10 / 16000 JS_ASSERT');
  });

  test('Horizontal Movement', () => {
    runner.proc.run('INIT_PLATFORMER');
    runner.proc.run('1 CMD_MOVE'); // Move Right
    runner.proc.run('UPDATE_PHYSICS');
    runner.proc.run('PLAYER_VY @ 5000 JS_ASSERT');
    runner.proc.run('PLAYER_VX @ 16000 JS_ASSERT');
  });

  test('Win Condition (GATE Tile)', () => {
    runner.proc.run('INIT_PLATFORMER');

    runner.proc.run('71 5 SET_TRANSITION');
    runner.proc.run('2 18 0 71 0 LOAD_TILE');

    runner.proc.run('2 65536 * PLAYER_X !');
    runner.proc.run('18 65536 * PLAYER_Y !');

    runner.proc.run('DEBUG_PLAYER_X');
    runner.proc.run('UPDATE_PHYSICS');
    runner.proc.run('DEBUG_PLAYER_X');

    runner.proc.run('PLAYER_X @ 327680 JS_ASSERT');
  });
});
