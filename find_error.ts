
import { AetherTranspiler } from './src/compiler/AetherTranspiler.ts';
import { PLATFORM_AJS_SOURCE } from './src/kernels/PlatformKernel.ts';
import { KernelID } from './src/types/Protocol.ts';

const output = AetherTranspiler.transpile(PLATFORM_AJS_SOURCE, KernelID.PLATFORM);
const lines = output.split('\n');
lines.forEach((line, i) => {
    if (line.includes('ERROR')) {
        console.log(`Line ${i+1}: ${line}`);
        // Print surrounding context
        for (let j = Math.max(0, i-5); j < Math.min(lines.length, i+5); j++) {
            console.log(`  ${j+1}: ${lines[j]}`);
        }
    }
});
