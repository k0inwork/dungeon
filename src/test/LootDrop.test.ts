
import { expect, test, describe, beforeAll } from 'vitest';
import { KernelTestRunner } from './KernelRunner';
import { IntegrationSimulator } from './IntegrationSimulator';
import { GRID_KERNEL_BLOCKS } from '../kernels/GridKernel';
import { BATTLE_KERNEL_BLOCKS } from '../kernels/BattleKernel';
import { KernelID, Opcode } from '../types/Protocol';

describe('Integration: Loot Drop', () => {
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

    // Initialize Kernels
    grid.run('INIT_MAP');
    battle.run('INIT_BATTLE');

    // Process SUB packets generated during boot/init
    sim.tick();
  });

  test('Rat drops loot on death', () => {
    // 1. Spawn Player at 1,1
    grid.run('1 1 65535 64 0 SPAWN_ENTITY');

    // 2. Spawn regular Rat at 2,1
    // type 1 = Passive/Regular Rat
    grid.run('2 1 16711680 114 1 SPAWN_ENTITY');

    // Allow packets to propagate (EVT_SPAWN to Battle Kernel)
    sim.tick();

    // 3. Verify Rat has HP and Item assigned in Battle Kernel
    const battleMem = new DataView(battle.getMemory());
    const ratRpgBase = 0xA0000 + (1 * 36); // ID 1, Size 36
    const initialHp = battleMem.getInt32(ratRpgBase, true);
    const invItem = battleMem.getInt32(ratRpgBase + 32, true); // OFF_INVITEM = 32

    expect(initialHp).toBe(100);
    expect(invItem).toBe(2003); // Regular Rat Fur

    // 4. Force Death of Rat
    // Send CMD_ATTACK from Player(0) to Rat(1) with high damage or just set HP to 0
    // Actually, we'll just send an attack that we know will kill it eventually,
    // or manually trigger death event for speed.
    // Let's use the skill system: Skill 3 (FIREBALL) does 40 dmg.
    // We'll just call EXECUTE_SKILL directly in Battle Kernel to simulate a kill.
    // Source=0, Target=1, Skill=3 (Fireball)
    battle.run('0 1 3 EXECUTE_SKILL');
    battle.run('0 1 3 EXECUTE_SKILL');
    battle.run('0 1 3 EXECUTE_SKILL'); // 120 DMG total > 100 HP

    // 5. Tick to propagate EVT_DEATH to GRID
    sim.tick();

    // 6. Verify Grid State
    const gridMem = new DataView(grid.getMemory());
    const ratGridBase = 0x90000 + (1 * 20);
    const ratColor = gridMem.getInt32(ratGridBase + 4, true);
    const ratType = gridMem.getInt32(ratGridBase + 16, true);

    expect(ratColor).toBe(8947848); // Gray
    expect(ratType).toBe(3); // ITEM

    // 7. Verify Loot "Popped"
    // The kill_entity logic spawns a Gold Coin '$' (36) at an adjacent tile.
    // Adjacent tiles to 2,1 are 3,1 (West is 1,1 which is player, so 3,1 is primary candidate)
    // Actually our logic tries ex+1 first. 2+1 = 3.
    const lootIdx = 1 * 40 + 3; // (y * width + x) -> (1 * 40 + 3) = 43
    const lootMapValue = new Uint8Array(grid.getMemory())[0x32000 + lootIdx];

    expect(lootMapValue).toBeGreaterThan(0);

    const lootId = lootMapValue - 1;
    const lootGridBase = 0x90000 + (lootId * 20);
    const lootChar = gridMem.getInt32(lootGridBase, true);
    const lootType = gridMem.getInt32(lootGridBase + 16, true);

    expect(lootChar).toBe(36); // '$'
    expect(lootType).toBe(3); // ITEM
  });
});
