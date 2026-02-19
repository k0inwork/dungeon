import { expect, test, beforeEach } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';
import { KernelID, hashChannel } from '../types/Protocol';

beforeEach(() => {
  AetherTranspiler.reset();
});

test('transpiles Chan.on with arity-4 listener', () => {
  const js = `
    function my_listener(op, p1, p2, p3) {
        Log("received");
    }
    function handle_events() {}
    function init_test() {
        Chan("test_chan").on(my_listener);
    }
  `;
  const forth = AetherTranspiler.transpile(js, KernelID.GRID);
  const hash = hashChannel("test_chan");

  // Check subscription in init word
  expect(forth).toContain(`SYS_CHAN_SUB ${KernelID.GRID} K_HOST ${hash} 0 0 BUS_SEND`);

  // Check dispatcher in handle_events
  expect(forth).toContain(`M_TARGET @ ${hash} = IF`);
  expect(forth).toContain(`M_OP @ M_P1 @ M_P2 @ M_P3 @ MY_LISTENER`);
});

test('transpiles Go-like channel send', () => {
  const js = `
    function test() {
        Chan("test_chan") <- [100, 1, 2, 3];
    }
  `;
  const forth = AetherTranspiler.transpile(js, KernelID.GRID);
  const hash = hashChannel("test_chan");

  expect(forth).toContain(`100`);
  expect(forth).toContain(`${hash} ( Channel: test_chan )`);
  expect(forth).toContain(`BUS_SEND`);
});

test('transpiles Chan.leave()', () => {
    const js = `
      function test() {
          Chan("test_chan").leave();
      }
    `;
    const forth = AetherTranspiler.transpile(js, KernelID.GRID);
    const hash = hashChannel("test_chan");

    expect(forth).toContain(`SYS_CHAN_UNSUB ${KernelID.GRID} K_HOST ${hash} 0 0 BUS_SEND`);
});

test('transpiles Chan with kernel name', () => {
    const js = `
      function test() {
          Chan("HIVE") <- [100, 1, 2, 3];
      }
    `;
    const forth = AetherTranspiler.transpile(js, KernelID.GRID);
    expect(forth).toContain(`K_HIVE`);
    expect(forth).toContain(`BUS_SEND`);
});
