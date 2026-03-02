import { describe, it, expect } from 'vitest';
import { AetherTranspiler } from '../compiler/AetherTranspiler';
import { forthService } from '../services/WaForthService';
import { STANDARD_KERNEL_FIRMWARE } from '../kernels/SharedBlocks';

describe('AetherTranspiler Extensions', () => {
    it('handles short-circuit logical expressions', async () => {
        const js = `
            function test() {
                let a = 1;
                let b = 0;
                let c = 2;
                return (a && b) || c;
            }
        `;
        const compiled = AetherTranspiler.transpile(js, 0);

        const proc = forthService.get("TEST_LOGIC");
        await proc.boot();
        STANDARD_KERNEL_FIRMWARE.forEach(block => proc.run(block));
        proc.run(compiled);

        // Output might be buffered, let's grab memory/stack directly if possible.
        // Or write a small helper to put it in memory:
        proc.run("VARIABLE OUT_L");
        proc.run(": RUN_TEST_L TEST OUT_L ! ;");
        proc.run("RUN_TEST_L");
        proc.run("OUT_L @ .N");
        // Output might be buffered with ok or not depending on when .N pushes. Let's find it.
        const logs = proc.outputLog.join(" ");
        expect(logs).toContain("2");
    });

    it('handles complex math and switch statements', async () => {
        const js = `
            function calc(x, y) {
                let val = (x + y) * 2;
                let res = 0;
                switch (val) {
                    case 10: res = 1; break;
                    case 20: res = 2; break;
                    default: res = 3;
                }
                return res;
            }
        `;
        const compiled = AetherTranspiler.transpile(js, 0);

        const proc = forthService.get("TEST_MATH");
        await proc.boot();
        STANDARD_KERNEL_FIRMWARE.forEach(block => proc.run(block));
        proc.run(compiled);

        proc.run("VARIABLE OUT_M");
        proc.run(": RUN_TEST_M1 5 5 CALC OUT_M ! ;");
        proc.run("RUN_TEST_M1");
        proc.run("OUT_M @ .N");
        let logs = proc.outputLog.join(" ");
        expect(logs).toContain("2");

        proc.run(": RUN_TEST_M2 10 5 CALC OUT_M ! ;");
        proc.run("RUN_TEST_M2");
        proc.run("OUT_M @ .N");
        logs = proc.outputLog.join(" ");
        expect(logs).toContain("3");
    });

    it('handles dynamic array push correctly', async () => {
        const js = `
            function test_array() {
                let arr = [10, 20];
                arr.push(30);

                // Pop is disabled, just test push and manual indexing.
                // length is 3, indexes are 0, 1, 2.
                let v1 = arr[1]; // 20
                let v2 = arr[2]; // 30

                return v1 + v2;
            }
        `;
        const compiled = AetherTranspiler.transpile(js, 0);

        const proc = forthService.get("TEST_ARR");
        await proc.boot();
        STANDARD_KERNEL_FIRMWARE.forEach(block => proc.run(block));
        proc.run(compiled);

        proc.run("VARIABLE OUT_A");
        proc.run("INIT_HEAP");
        // Ensure words are available
        proc.run(": RUN_TEST_A TEST_ARRAY OUT_A ! ;");
        proc.run("RUN_TEST_A");
        proc.run("OUT_A @ .N");
        // 20 + 30 = 50
        const logs = proc.outputLog.join(" ");
        expect(logs).toContain("50");
    });
});
