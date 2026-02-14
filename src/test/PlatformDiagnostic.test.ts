
import { describe, it, expect, beforeAll } from 'vitest';
import { AetherTranspiler } from './src/compiler/AetherTranspiler';
import { KernelID } from './src/types/Protocol';
import { PLATFORM_AJS_SOURCE } from './src/kernels/PlatformKernel';
import { KernelTestRunner } from './src/test/KernelRunner';
import { PLATFORM_KERNEL_BLOCKS } from './src/kernels/PlatformKernel';

describe('PlatformKernel Diagnostic', () => {
  beforeAll(() => {
    AetherTranspiler.reset();
  });

  it('should transpile and boot PlatformKernel', async () => {
    const runner = new KernelTestRunner('PLATFORM', KernelID.PLATFORM);
    // Boot with all blocks
    await runner.boot(PLATFORM_KERNEL_BLOCKS);

    // Check if RUN_PLATFORM_CYCLE is defined
    expect(runner.proc.isWordDefined('RUN_PLATFORM_CYCLE')).toBe(true);
  });

  it('INIT_PLATFORMER initializes memory correctly', async () => {
    const runner = new KernelTestRunner('PLATFORM', KernelID.PLATFORM);
    await runner.boot(PLATFORM_KERNEL_BLOCKS);

    runner.run("INIT_PLATFORMER");

    // Check player_x
    const out = runner.run("PLAYER_X @ .N");
    expect(out).toContain("131072");

    // Check current_level
    const out2 = runner.run("CURRENT_LEVEL @ .N");
    expect(out2).toContain("0");
  });
});
