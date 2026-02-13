
import { expect, test, beforeEach } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';

beforeEach(() => {
  AetherTranspiler.reset();
});

test('transpiles array of structs', () => {
  const js = `
    struct TestNPC { a, b }
    const npcs = new Array(TestNPC, 100);
    function test() {
      npcs[1].a = 5;
      let k = npcs[2];
      k.b = 10;
    }
  `;
  const forth = AetherTranspiler.transpile(js);
  console.log(forth);

  // Check for struct size and offsets
  expect(forth).toContain('8 CONSTANT SIZEOF_TESTNPC');
  expect(forth).toContain('0 CONSTANT OFF_A');
  expect(forth).toContain('4 CONSTANT OFF_B');

  // Check for allocation
  expect(forth).toContain('CREATE NPCS 100 SIZEOF_TESTNPC * ALLOT');

  // Check for access npcs[1].a = 5
  expect(forth).toMatch(/5\s+NPCS\s+1\s+SIZEOF_TESTNPC\s+\*\s+\+\s+OFF_TESTNPC_A\s+\+\s+!/);

  // Check for let k = npcs[2]
  expect(forth).toMatch(/NPCS\s+2\s+SIZEOF_TESTNPC\s+\*\s+\+\s+LV_TEST_K\s+!/);

  // Check for k.b = 10
  expect(forth).toMatch(/10\s+LV_TEST_K\s+@\s+OFF_TESTNPC_B\s+\+\s+!/);
});

test('transpiles local array of structs', () => {
  const js = `
    struct TestNPC { a, b }
    function test() {
      const local_npcs = new Array(TestNPC, 5);
      local_npcs[0].a = 42;
    }
  `;
  const forth = AetherTranspiler.transpile(js);
  console.log(forth);

  // Check for allocation at top level
  expect(forth).toContain('CREATE LV_TEST_LOCAL_NPCS 5 SIZEOF_TESTNPC * ALLOT');

  // Check for access
  expect(forth).toMatch(/42\s+LV_TEST_LOCAL_NPCS\s+0\s+SIZEOF_TESTNPC\s+\*\s+\+\s+OFF_TESTNPC_A\s+\+\s+!/);
});

test('transpiles exported struct and struct-function syntax', () => {
  const js = `
    struct TestNPC { a, b }
    const npcs1 = new Array(TestNPC, 100);
    export npcs1;
    function test() {
      TestNPC(1).a = 5;
      let k = TestNPC(2);
      k.b = 10;
    }
  `;
  const forth = AetherTranspiler.transpile(js);
  console.log(forth);

  expect(forth).toContain('CREATE NPCS1 100 SIZEOF_TESTNPC * ALLOT');
  // TestNPC(1).a = 5 -> 5 1 NPCS1 SWAP SIZEOF_TESTNPC * + OFF_TESTNPC_A + !
  expect(forth).toMatch(/5\s+1\s+NPCS1\s+SWAP\s+SIZEOF_TESTNPC\s+\*\s+\+\s+OFF_TESTNPC_A\s+\+\s+!/);
  // let k = TestNPC(2) -> 2 NPCS1 SWAP SIZEOF_TESTNPC * + LV_TEST_K !
  expect(forth).toMatch(/2\s+NPCS1\s+SWAP\s+SIZEOF_TESTNPC\s+\*\s+\+\s+LV_TEST_K\s+!/);
});

test('transpiles struct array with constant size', () => {
  const js = `
    struct TestNPC { a }
    const SIZE = 10;
    const npcs = new Array(TestNPC, SIZE);
  `;
  const forth = AetherTranspiler.transpile(js);
  console.log(forth);
  expect(forth).toContain('10 CONSTANT SIZE');
  expect(forth).toContain('CREATE NPCS SIZE SIZEOF_TESTNPC * ALLOT');
});
