
import { expect, test, describe, beforeAll } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { IntegrationSimulator } from './IntegrationSimulator';
import { GRID_KERNEL_BLOCKS } from '../kernels/GridKernel';
import { BATTLE_KERNEL_BLOCKS } from '../kernels/BattleKernel';
import { KernelID, Opcode } from '../types/Protocol';

describe('Loot Inventory', () => {
  let sim: IntegrationSimulator;
  let grid: KernelTestRunner;
  let battle: KernelTestRunner;

  beforeAll(async () => {
    sim = new IntegrationSimulator();
    grid = new KernelTestRunner('GRID', KernelID.GRID);
    await grid.boot(GRID_KERNEL_BLOCKS);
    sim.addKernel(KernelID.GRID, 'GRID', grid);

    battle = new KernelTestRunner('BATTLE', KernelID.BATTLE);
    await battle.boot(BATTLE_KERNEL_BLOCKS);
    sim.addKernel(KernelID.BATTLE, 'BATTLE', battle);

    grid.run('INIT_MAP');
  });

  test('Dropped loot contains the entitys inventory item', async () => {
    // 0. Spawn Player
    grid.run('1 1 65535 64 0 SPAWN_ENTITY');

    // 1. Spawn Entity at 5,5
    // type 1 = Mutant Rat
    grid.run('5 5 16711680 114 1 SPAWN_ENTITY');
    const entityId = 1;

    // Tick to allow BATTLE to process EVT_SPAWN
    sim.tick(); // GRID sends EVT_SPAWN
    sim.tick(); // BATTLE receives EVT_SPAWN and calls init_stats

    // 2. Set invItem for that entity in Battle Kernel (Override default)
    const RPG_TABLE_ADDR = 0xA0000;
    const ENTITY_SIZE = 36;
    const itemToDrop = 2025;

    const battleMem = new Int32Array(battle.getMemory(), RPG_TABLE_ADDR + (entityId * ENTITY_SIZE), 10);
    battleMem[8] = itemToDrop; // invItem at offset 32

    // 3. Kill the entity
    grid.run(`${Opcode.EVT_DEATH} ${KernelID.BATTLE} ${KernelID.GRID} ${entityId} 0 0 BUS_SEND`);

    sim.tick(); // Move EVT_DEATH to GRID inbox
    sim.tick(); // GRID processes EVT_DEATH, calls kill_entity

    // 4. Try pickup at 5,5
    grid.run(`${Opcode.CMD_PICKUP} ${KernelID.PLAYER} ${KernelID.GRID} 0 5 5 BUS_SEND`);

    sim.tick(); // Move CMD_PICKUP to GRID inbox
    sim.tick(); // GRID processes CMD_PICKUP, calls try_pickup, sends EVT_ITEM_GET
    sim.tick(); // Move EVT_ITEM_GET to PLAYER (and bus log)

    // 5. Check if Player received the item
    const itemGetEvent = sim.packetLog.find(p => p.op === 'EVT_ITEM_GET' && p.p1 === 0);
    expect(itemGetEvent).toBeDefined();
    expect(itemGetEvent?.p2).toBe(itemToDrop);
  });
});
