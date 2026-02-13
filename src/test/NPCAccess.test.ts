
import { expect, test, describe, beforeAll } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';
import { KernelTestRunner } from './KernelRunner';
import { IntegrationSimulator } from './IntegrationSimulator';
import { KernelID } from '../types/Protocol';
import { STANDARD_KERNEL_FIRMWARE } from '../kernels/SharedBlocks';

describe('NPC VSO Access', () => {
  beforeAll(() => {
    AetherTranspiler.reset();
  });

  test('Generic struct XXX(id) access works for dynamically exported VSOs', async () => {
    const sim = new IntegrationSimulator();

    const jsA = `
      struct MyData { val1, val2 }
      let data_array = new Array(MyData, 10, 0x80000);
      export data_array;
      function init() {
        MyData(0).val1 = 123;
        MyData(1).val1 = 456;
      }
    `;

    const jsB = `
      function get_val(id) {
        let d = MyData(id);
        return d.val1;
      }
    `;

    const forthA = AetherTranspiler.transpile(jsA, KernelID.TEST1);
    const forthB = AetherTranspiler.transpile(jsB, KernelID.TEST2);

    const runnerA = new KernelTestRunner('TEST1', KernelID.TEST1);
    await runnerA.boot([...STANDARD_KERNEL_FIRMWARE, forthA]);
    sim.addKernel(KernelID.TEST1, 'TEST1', runnerA);

    const runnerB = new KernelTestRunner('TEST2', KernelID.TEST2);
    await runnerB.boot([...STANDARD_KERNEL_FIRMWARE, forthB]);
    sim.addKernel(KernelID.TEST2, 'TEST2', runnerB);

    runnerA.proc.run('INIT');

    runnerB.proc.forth.interpret('0 GET_VAL\n');
    expect(runnerB.proc.forth.pop()).toBe(123);

    runnerB.proc.forth.interpret('1 GET_VAL\n');
    expect(runnerB.proc.forth.pop()).toBe(456);
  });
});
