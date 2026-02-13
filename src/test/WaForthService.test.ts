
import { expect, test, describe } from 'vitest';
import { forthService } from '../services/WaForthService';

describe('WaForthService isWordDefined', () => {
  test('isWordDefined does not pollute emitBuffer', async () => {
    const proc = forthService.get("TEST_LOG");
    await proc.boot();

    // 1. Define a word
    proc.run(": MY_TEST_WORD ;");

    // Clear buffer (run usually clears it, but let's be sure)
    proc.emitBuffer = "";

    // 2. Check existence of existing word
    const exists = proc.isWordDefined("MY_TEST_WORD");
    expect(exists).toBe(true);
    expect(proc.emitBuffer).toBe("");

    // 3. Check existence of non-existing word
    const exists2 = proc.isWordDefined("NON_EXISTENT_WORD");
    expect(exists2).toBe(false);
    expect(proc.emitBuffer).toBe("");

    // 4. Verify that subsequent run doesn't pick up junk
    // If it did, this run would log the junk from previous checks
    const logCountBefore = proc.outputLog.length;
    proc.run(": ANOTHER_WORD ;");
    const logCountAfter = proc.outputLog.length;

    // We expect only one new log entry (the "Process Booted" happened earlier,
    // but here we are checking the STDOUT log from the successful interpret)
    // Actually, proc.run will log "[STDOUT]  ok" if WAForth emits " ok\n".

    const latestLog = proc.outputLog[proc.outputLog.length - 1];
    expect(latestLog).not.toContain("undefined word");
  });
});
