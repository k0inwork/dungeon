
import { describe, it, expect, beforeAll } from 'vitest';
import { IntegrationSimulator } from './IntegrationSimulator';
import { KernelTestRunner } from './KernelRunner';
import { KernelID, Opcode } from '../types/Protocol';
import { GRID_KERNEL_BLOCKS } from '../kernels/GridKernel';
import { BATTLE_KERNEL_BLOCKS } from '../kernels/BattleKernel';
import { AetherTranspiler } from '../compiler/AetherTranspiler';

describe('Rat Loot Integration', () => {
  beforeAll(() => {
    AetherTranspiler.reset();
  });

  it('should drop Rat Tail (2002) for aggressive rats (R)', async () => {
    const sim = new IntegrationSimulator();

    const runnerGrid = new KernelTestRunner('GRID', KernelID.GRID);
    await runnerGrid.boot(GRID_KERNEL_BLOCKS);
    sim.addKernel(KernelID.GRID, 'GRID', runnerGrid);

    const runnerBattle = new KernelTestRunner('BATTLE', KernelID.BATTLE);
    await runnerBattle.boot(BATTLE_KERNEL_BLOCKS);
    sim.addKernel(KernelID.BATTLE, 'BATTLE', runnerBattle);

    // Spawn Player (ID 0)
    runnerGrid.proc.run('5 5 65535 64 0 SPAWN_ENTITY');
    sim.tick();

    // 1. Spawn an aggressive rat 'R' (CharCode 82)
    // type 2 = aggressive
    runnerGrid.proc.run('10 10 16711680 82 2 SPAWN_ENTITY');

    // Wait for event propagation (GRID -> BATTLE)
    sim.tick();
    sim.tick();

    console.log("[TEST] GRID Memory Entity 1 Char:", new DataView(runnerGrid.getMemory()).getInt32(0x90018, true));

    // Check if BATTLE kernel set the correct invItem
    // RPG_TABLE_ADDR = 0xA0000. Entity 1 (0 is player)
    // invItem is at offset 32.
    // Address = 0xA0000 + 1 * 36 + 32 = 0xA0044
    const battleMem = new DataView(runnerBattle.getMemory());
    const ratBase = 0xA0000 + 1 * 36;
    console.log("[TEST] BATTLE Memory Entity 1 (Rat):");
    for (let i = 0; i < 9; i++) {
        console.log(`  Offset ${i*4}: ${battleMem.getInt32(ratBase + i*4, true)}`);
    }
    const invItem = battleMem.getInt32(0xA0044, true);
    expect(invItem).toBe(2002);

    // 2. Kill the rat
    // Send EVT_DEATH to GRID (targeted at K_BUS or K_GRID)
    // p1 = id
    sim.busSend(Opcode.EVT_DEATH, KernelID.BATTLE, KernelID.GRID, 1, 0, 0);
    sim.tick();

    // Check if GRID dropped loot with correct ID
    // ENTITY_TABLE_ADDR = 0x90000. Entity 1.
    // itemId is at offset 20.
    // Address = 0x90000 + 1 * 24 + 20 = 0x9002C
    const gridMem = new DataView(runnerGrid.getMemory());
    const lootId = gridMem.getInt32(0x9002C, true);

    expect(lootId).toBe(2002);
  });
});
