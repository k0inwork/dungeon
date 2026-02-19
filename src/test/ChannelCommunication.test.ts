
import { expect, test, describe, beforeAll } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { IntegrationSimulator } from './IntegrationSimulator';
import { GRID_KERNEL_BLOCKS } from '../kernels/GridKernel';
import { HIVE_KERNEL_BLOCKS } from '../kernels/HiveKernel';
import { KernelID, Opcode, hashChannel } from '../types/Protocol';

describe('Integration: Named Channels', () => {
  let sim: IntegrationSimulator;
  let grid: KernelTestRunner;
  let hive: KernelTestRunner;

  beforeAll(async () => {
    sim = new IntegrationSimulator();

    grid = new KernelTestRunner('GRID', KernelID.GRID);
    sim.addKernel(KernelID.GRID, 'GRID', grid);
    await grid.boot(GRID_KERNEL_BLOCKS);

    hive = new KernelTestRunner('HIVE', KernelID.HIVE);
    sim.addKernel(KernelID.HIVE, 'HIVE', hive);
    await hive.boot(HIVE_KERNEL_BLOCKS);

    // Initialize Kernels
    grid.run('INIT_MAP');
    hive.run('INIT_HIVE');

    // Process tick to handle subscriptions that happened during boot/init
    grid.run('AJS_INIT_CHANNELS');
    hive.run('AJS_INIT_CHANNELS');
    sim.tick();
  });

  test('Hive receives movement via npc_sync channel', () => {
    const hash = hashChannel("npc_sync");

    // 1. Verify subscription was registered in the simulator
    expect(sim.channelSubscriptions.get(hash)).toBeDefined();
    expect(sim.channelSubscriptions.get(hash)).toContain(KernelID.HIVE);

    // 2. Spawn Player in Grid (Grid will broadcast to channel)
    grid.run('10 10 65535 64 0 SPAWN_ENTITY');

    // 3. Tick to deliver SPAWN and MOVED messages
    sim.tick();

    // 4. Check if Hive has updated its LAST_PLAYER_X/Y
    // Hive implementation:
    // if (p1 == 0) { LAST_PLAYER_X = p2; LAST_PLAYER_Y = p3; }
    const hiveX = hive.run('LAST_PLAYER_X @ .N').replace(/\0/g, '').trim();
    const hiveY = hive.run('LAST_PLAYER_Y @ .N').replace(/\0/g, '').trim();

    expect(hiveX).toContain("10");
    expect(hiveY).toContain("10");

    // 5. Move player in Grid
    grid.run('0 1 1 MOVE_ENTITY'); // Move player (ID 0) by dx=1, dy=1
    sim.tick();

    const hiveX2 = hive.run('LAST_PLAYER_X @ .N').replace(/\0/g, '').trim();
    expect(hiveX2).toContain("11");
  });
});
