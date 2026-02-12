import { expect, test } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';

test('transpiles top-level constants', () => {
  const js = `
    const MAP_WIDTH = 40;
    const COLLISION_MAP = 0x30000;
    function get_width() { return MAP_WIDTH; }
  `;
  const forth = AetherTranspiler.transpile(js);
  expect(forth).toContain('40 CONSTANT MAP_WIDTH');
  expect(forth).toContain('196608 CONSTANT COLLISION_MAP');
  expect(forth).toContain('  MAP_WIDTH'); // No @ for constants
});

test('transpiles top-level variables', () => {
  const js = `
    let entity_count = 0;
    function get_ent() { return entity_count; }
  `;
  const forth = AetherTranspiler.transpile(js);
  expect(forth).toContain('VARIABLE ENTITY_COUNT');
  expect(forth).toContain('  0');
  expect(forth).toContain('  ENTITY_COUNT !');
  expect(forth).toContain('  ENTITY_COUNT @');
});

test('transpiles typed arrays', () => {
  const js = `
    const collision_map = new Uint8Array(0x30000);
    function set_col(i, v) { collision_map[i] = v; }
    function get_col(i) { return collision_map[i]; }
  `;
  const forth = AetherTranspiler.transpile(js);
  expect(forth).toContain('196608 CONSTANT COLLISION_MAP');
  expect(forth).toContain('+ C!');
  expect(forth).toContain('+ C@');
});

test('transpiles local byte arrays', () => {
    const js = `
      function test() {
          let buf = new Uint8Array(100);
          buf[0] += 5;
      }
    `;
    const forth = AetherTranspiler.transpile(js);
    expect(forth).toContain('VARIABLE LV_TEST_BUF');
    expect(forth).toContain('+ DUP C@ ROT + SWAP C!');
});
