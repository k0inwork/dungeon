import { expect, test, describe } from 'vitest';
import { forthService } from '../services/WaForthService';
import { GRID_KERNEL_BLOCKS } from '../kernels/GridKernel';
import { HIVE_KERNEL_BLOCKS } from '../kernels/HiveKernel';

describe('Persistence: Kernel Hibernate & Restore', () => {
  test('Kernel preserves state across hibernation', async () => {
    // 1. Boot and Setup Grid Kernel
    const id = "GRID_TEST";
    const proc = await forthService.bootProcess(id);
    proc.logicBlocks = GRID_KERNEL_BLOCKS;
    for (const block of GRID_KERNEL_BLOCKS) {
        proc.run(block);
    }
    proc.run("INIT_MAP");

    // 2. Spawn an entity and set its position
    // SPAWN_ENTITY (x y color char type -- )
    proc.run("5 5 16711680 114 1 SPAWN_ENTITY");

    // Verify initial position
    const mem1 = new DataView(proc.getMemory());
    expect(mem1.getInt32(0x90000 + 12, true)).toBe(5); // X
    expect(mem1.getInt32(0x90000 + 8, true)).toBe(5);  // Y

    // 3. Hibernate
    await proc.hibernate();
    expect(proc.status).toBe("FLASHED");
    expect(proc.forth).toBeNull();

    // 4. Awaken
    await proc.awaken();
    expect(proc.status).toBe("ACTIVE");
    expect(proc.forth).not.toBeNull();

    // 5. Verify restored state
    const mem2 = new DataView(proc.getMemory());
    expect(mem2.getInt32(0x90000 + 12, true)).toBe(5); // X
    expect(mem2.getInt32(0x90000 + 8, true)).toBe(5);  // Y

    // 6. Test logic works
    proc.run("0 1 1 MOVE_ENTITY"); // Move ID 0 by 1,1
    expect(mem2.getInt32(0x90000 + 12, true)).toBe(6); // X
    expect(mem2.getInt32(0x90000 + 8, true)).toBe(6);  // Y
  });

  test('Hive Kernel preserves state and logic across hibernation', async () => {
    const id = "HIVE_TEST";
    const proc = await forthService.bootProcess(id);
    proc.logicBlocks = HIVE_KERNEL_BLOCKS;
    for (const block of HIVE_KERNEL_BLOCKS) {
        proc.run(block);
    }
    proc.run("INIT_HIVE");

    // Verify it works
    proc.run("INIT_HIVE"); // Should not fail

    await proc.hibernate();
    await proc.awaken();

    // Verify it still works
    proc.run("INIT_HIVE");
  });

  test('Global serialization preserves all kernels', async () => {
    // Reset service
    // @ts-ignore
    forthService.processes.clear();

    const p1 = await forthService.bootProcess("P1");
    p1.logicBlocks = [": INC 1 + ;", "VARIABLE V"];
    for (const b of p1.logicBlocks) p1.run(b);
    p1.run("10 V !");

    const p2 = await forthService.bootProcess("P2");
    p2.logicBlocks = [": DBL 2 * ;", "VARIABLE V"];
    for (const b of p2.logicBlocks) p2.run(b);
    p2.run("20 V !");

    // Global Save
    const state = forthService.serializeAll();

    // Global Load
    await forthService.deserializeAll(state);

    const r1 = forthService.get("P1");
    const r2 = forthService.get("P2");

    expect(r1.logicBlocks[0]).toBe(": INC 1 + ;");
    expect(r2.logicBlocks[0]).toBe(": DBL 2 * ;");

    // Check variable values
    const m1 = new DataView(r1.getMemory());
    const m2 = new DataView(r2.getMemory());

    // We need to find the address of V, but we know it's deterministic.
    // Let's just run a word to check.
    r1.run("V @ .");
    r2.run("V @ .");

    expect(r1.outputLog.some(l => l.includes("10 ok"))).toBe(true);
    expect(r2.outputLog.some(l => l.includes("20 ok"))).toBe(true);
  });
});
