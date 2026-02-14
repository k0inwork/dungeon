import { describe, it, expect, vi } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';
import { PLATFORM_AJS_SOURCE } from '../kernels/PlatformKernel';
import { KernelID } from '../types/Protocol';

describe('PlatformKernel Transpilation', () => {
    it('transpiles successfully without errors', () => {
        const output = AetherTranspiler.transpile(PLATFORM_AJS_SOURCE, KernelID.PLATFORM);
        expect(output).toContain(': RENDER');
        expect(output).toContain(': UPDATE_PHYSICS');
        // Check for transpiler error comments specifically
        expect(output).not.toContain('( ERROR:');
    });

    it('emits correct VRAM address access', () => {
        const output = AetherTranspiler.transpile(PLATFORM_AJS_SOURCE, KernelID.PLATFORM);
        // Look for VRAM [ i ] = ...
        // which should be VRAM LV_RENDER_I @ CELLS + !
        // We use regex to ignore whitespace/newlines between words
        expect(output).toMatch(/VRAM\s+LV_RENDER_I\s+@\s+CELLS\s+\+\s+!/);
    });
});
