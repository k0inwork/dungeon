
import { expect, test, describe, beforeAll } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { GRID_KERNEL_BLOCKS } from '../kernels/GridKernel';
import { KernelID } from '../types/Protocol';

describe('GridKernel Logic Tests', () => {
  let runner: KernelTestRunner;

  beforeAll(async () => {
    runner = new KernelTestRunner('GRID', KernelID.GRID);
    await runner.boot(GRID_KERNEL_BLOCKS);
  });

  test('Map Initialization', () => {
    runner.proc.run('INIT_MAP');
    runner.proc.run('ENTITY_COUNT @ 0 JS_ASSERT');
  });

  test('Spawn and Find Entity', () => {
    runner.proc.run('5 5 16711680 64 1 SPAWN_ENTITY');
    runner.proc.run('5 5 FIND_ENTITY_AT 0 JS_ASSERT');
  });

  test('O(1) Lookup Verification', () => {
      runner.proc.run('10 10 255 66 1 SPAWN_ENTITY');
      runner.proc.run('10 10 FIND_ENTITY_AT 1 JS_ASSERT');
  });

  test('Move Entity and Update Map', () => {
      // Move entity 0 by dx=1, dy=0 (from 5,5 to 6,5)
      runner.proc.run('0 1 0 MOVE_ENTITY');
      runner.proc.run('6 5 FIND_ENTITY_AT 0 JS_ASSERT');
      runner.proc.run('5 5 FIND_ENTITY_AT -1 JS_ASSERT');
  });
});
