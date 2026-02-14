
import { expect, test } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';
import { PLATFORM_AJS_SOURCE } from '../kernels/PlatformKernel';
import { KernelID } from '../types/Protocol';

test('print platform transpilation', () => {
  const output = AetherTranspiler.transpile(PLATFORM_AJS_SOURCE, KernelID.PLATFORM);
  console.log(output);
});
