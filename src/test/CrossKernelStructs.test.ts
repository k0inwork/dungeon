
import { expect, test, describe, beforeAll } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';
import { KernelTestRunner } from './KernelRunner';
import { KernelID } from '../types/Protocol';

describe('Cross-Kernel Struct Arrays', () => {
  beforeAll(() => {
    AetherTranspiler.resetGlobalRegistry();
  });

  test('Kernel A exports, Kernel B consumes', async () => {
    const jsA = `
      struct NPC { hp, atk }
      let npcs = new Array(NPC, 10);
      export npcs;
      function init() {
        NPC(0).hp = 100;
        NPC(1).hp = 50;
      }
    `;

    const jsB = `
      struct NPC { hp, atk }
      function check(id) {
        let n = NPC(id);
        return n.hp;
      }
    `;

    // Add necessary Forth declarations
    const preamble = `
      : JS_REGISTER_VSO ( addr typeId sizeBytes -- ) S" JS_REGISTER_VSO" SCALL ;
      : JS_SYNC_OBJECT ( id typeId -- ptr ) S" JS_SYNC_OBJECT" SCALL ;
    `;

    const forthA = AetherTranspiler.transpile(jsA, KernelID.BATTLE);
    const forthB = AetherTranspiler.transpile(jsB, KernelID.GRID);

    const runnerA = new KernelTestRunner('BATTLE', KernelID.BATTLE);
    await runnerA.boot([preamble, forthA]);

    const runnerB = new KernelTestRunner('GRID', KernelID.GRID);
    await runnerB.boot([preamble, forthB]);

    // Run init in A
    runnerA.proc.run('INIT');

    // Check in B
    runnerB.proc.forth.interpret('0 CHECK\n');
    const hp0 = runnerB.proc.forth.pop();

    runnerB.proc.forth.interpret('1 CHECK\n');
    const hp1 = runnerB.proc.forth.pop();

    expect(hp0).toBe(100);
    expect(hp1).toBe(50);
  });
});
