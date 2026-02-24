import { expect, test, beforeEach } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';

beforeEach(() => {
  AetherTranspiler.reset();
});

test('transpiles local variables to stack', () => {
  const js = 'function test(a, b) { let x = a + b; return x; }';
  const forth = AetherTranspiler.transpile(js);

  // Should NOT contain VARIABLE LV_...
  expect(forth).not.toContain('VARIABLE LV_TEST_X');
  expect(forth).not.toContain('VARIABLE LV_TEST_A');
  expect(forth).not.toContain('VARIABLE LV_TEST_B');

  // Should contain stack management
  expect(forth).toContain('ENTER_FRAME');
  expect(forth).toContain('LEAVE_FRAME');

  // Should contain offsets and LOCAL_VARS
  // a: 0, b: 4, x: 8
  expect(forth).toContain('0 LOCAL_VARS');
  expect(forth).toContain('4 LOCAL_VARS');
  expect(forth).toContain('8 LOCAL_VARS');

  // Should contain comments
  expect(forth).toContain('let x = a + b;');
  expect(forth).toContain('return x;');
});

test('handles local struct arrays on stack', () => {
  const js = `
    struct Point { x, y }
    function test() {
      let pts = new Array(Point, 2);
      pts[0].x = 10;
    }
  `;
  const forth = AetherTranspiler.transpile(js);

  // Point size is 8. 2 Points = 16 bytes.
  // pts offset 0, size 16.
  expect(forth).toContain('4 ENTER_FRAME');
  expect(forth).toContain('0 LOCAL_VARS');
});
