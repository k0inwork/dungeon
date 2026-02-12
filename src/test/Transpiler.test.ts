import { expect, test, beforeEach } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';

beforeEach(() => {
  AetherTranspiler.reset();
});

test('transpiles simple assignment', () => {
  const js = 'function test() { let x = 10; }';
  const forth = AetherTranspiler.transpile(js);
  expect(forth).toContain('10');
  expect(forth).toContain('VARIABLE LV_TEST_X');
});
