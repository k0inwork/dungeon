
import { expect, test, beforeEach } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';

beforeEach(() => {
  AetherTranspiler.reset();
});

test('transpiles array of structs', () => {
  const js = `
    struct NPC { hp, power }
    const npcs = new Array(NPC, 100);
    function test() {
      npcs[1].hp = 5;
      let k = npcs[2];
      k.power = 10;
    }
  `;
  const forth = AetherTranspiler.transpile(js);
  console.log(forth);

  // Check for struct size and offsets
  expect(forth).toContain('8 CONSTANT SIZEOF_NPC');
  expect(forth).toContain('0 CONSTANT OFF_HP');
  expect(forth).toContain('4 CONSTANT OFF_POWER');

  // Check for allocation
  expect(forth).toContain('CREATE NPCS 100 SIZEOF_NPC * ALLOT');

  // Check for access npcs[1].hp = 5
  expect(forth).toMatch(/5\s+NPCS\s+1\s+SIZEOF_NPC\s+\*\s+\+\s+OFF_NPC_HP\s+\+\s+!/);

  // Check for let k = npcs[2]
  expect(forth).toMatch(/NPCS\s+2\s+SIZEOF_NPC\s+\*\s+\+\s+LV_TEST_K\s+!/);

  // Check for k.power = 10
  expect(forth).toMatch(/10\s+LV_TEST_K\s+@\s+OFF_NPC_POWER\s+\+\s+!/);
});

test('transpiles local array of structs', () => {
  const js = `
    struct NPC { hp, power }
    function test() {
      const local_npcs = new Array(NPC, 5);
      local_npcs[0].hp = 42;
    }
  `;
  const forth = AetherTranspiler.transpile(js);
  console.log(forth);

  // Check for allocation at top level
  expect(forth).toContain('CREATE LV_TEST_LOCAL_NPCS 5 SIZEOF_NPC * ALLOT');

  // Check for access
  expect(forth).toMatch(/42\s+LV_TEST_LOCAL_NPCS\s+0\s+SIZEOF_NPC\s+\*\s+\+\s+OFF_NPC_HP\s+\+\s+!/);
});

test('transpiles exported struct and struct-function syntax', () => {
  const js = `
    struct NPC { hp, power }
    const npcs1 = new Array(NPC, 100);
    export npcs1;
    function test() {
      NPC(1).hp = 5;
      let k = NPC(2);
      k.power = 10;
    }
  `;
  const forth = AetherTranspiler.transpile(js);
  console.log(forth);

  expect(forth).toContain('CREATE NPCS1 100 SIZEOF_NPC * ALLOT');
  // NPC(1).hp = 5 -> 5 1 NPCS1 SWAP SIZEOF_NPC * + OFF_NPC_HP + !
  expect(forth).toMatch(/5\s+1\s+NPCS1\s+SWAP\s+SIZEOF_NPC\s+\*\s+\+\s+OFF_NPC_HP\s+\+\s+!/);
  // let k = NPC(2) -> 2 NPCS1 SWAP SIZEOF_NPC * + LV_TEST_K !
  expect(forth).toMatch(/2\s+NPCS1\s+SWAP\s+SIZEOF_NPC\s+\*\s+\+\s+LV_TEST_K\s+!/);
});

test('transpiles struct array with constant size', () => {
  const js = `
    struct NPC { hp, power }
    const SIZE = 10;
    const npcs = new Array(NPC, SIZE);
  `;
  const forth = AetherTranspiler.transpile(js);
  console.log(forth);
  expect(forth).toContain('10 CONSTANT SIZE');
  expect(forth).toContain('CREATE NPCS SIZE SIZEOF_NPC * ALLOT');
});
