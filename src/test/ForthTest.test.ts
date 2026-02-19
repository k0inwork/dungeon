import { expect, test, beforeEach } from 'vitest';
import { ForthProcess } from '../services/WaForthService';
import { forthService } from '../services/WaForthService';

test('Forth EXECUTE works', async () => {
    const proc = forthService.get('TEST');
    await proc.boot();
    proc.run('VARIABLE MY_XT');
    proc.run(': TEST_WORD 123 . ;');
    proc.run('\' TEST_WORD MY_XT !');
    proc.run(': CALL_XT MY_XT @ EXECUTE ;');

    const logs = proc.outputLog;
    proc.run('CALL_XT');

    expect(proc.outputLog.some(l => l.includes('123'))).toBe(true);
});
