
import { expect, test, describe, beforeAll } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { BATTLE_KERNEL_BLOCKS } from '../kernels/BattleKernel';
import { KernelID } from '../types/Protocol';

describe('BattleKernel Logic Tests', () => {
  let runner: KernelTestRunner;

  beforeAll(async () => {
    runner = new KernelTestRunner('BATTLE', KernelID.BATTLE);
    await runner.boot(BATTLE_KERNEL_BLOCKS);
  });

  test('RPG Stats Initialization', () => {
    runner.run('0 1 INIT_STATS');
    // HP for Player (ID 0) should be 200
    runner.run('0 GET_RPG_PTR OFF_HP + @ 200 JS_ASSERT');
  });

  test('Basic Attack', () => {
      runner.run('1 1 INIT_STATS');
      runner.run('0 1 0 EXECUTE_SKILL');

      // Check HP of Enemy 1: 100 - (20 - 2) = 82
      runner.run('1 GET_RPG_PTR OFF_HP + @ 82 JS_ASSERT');
  });
});
