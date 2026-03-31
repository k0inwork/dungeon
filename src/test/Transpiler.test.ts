import { expect, test, beforeEach } from 'vitest';
import { forthService } from '../services/WaForthService';

test('check isWordDefined patch', async () => {
    const proc = await forthService.bootProcess("TEST_PROC");

    // The previous run emitted: Logs emitted by Forth: undefined word: MISSING_WORD
    const isDefinedMissing = proc.isWordDefined("MISSING_WORD");
    console.log("Is MISSING_WORD defined?", isDefinedMissing);

    proc.run(": A_REAL_WORD ;");
    const isDefinedReal = proc.isWordDefined("A_REAL_WORD");
    console.log("Is A_REAL_WORD defined?", isDefinedReal);

    expect(isDefinedMissing).toBe(false);
    expect(isDefinedReal).toBe(true);
});
