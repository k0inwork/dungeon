const { readFileSync } = require('fs');
const { WAForth } = require('waforth');

async function main() {
  const forth = new WAForth();
  await forth.load();
  forth.onEmit = (c) => process.stdout.write(c);

  const firmware = readFileSync('src/config/firmware/SharedBlocks.ts', 'utf8')
    .split('\n')
    .filter(line => !line.startsWith('//') && !line.startsWith('export'))
    .join('\n');

  const rawFirmware = firmware.replace(/`/g, '').replace(/export const [A-Z_]+ = /g, '');

  const forthCode = readFileSync('out2.f', 'utf8');

  let codeToRun = `
: JS_ERR ." Error! " ;
VARIABLE TEMP_VSO_BUFFER 10 CELLS ALLOT
VARIABLE JS_LOG
  ` + rawFirmware + forthCode + `
VARIABLE OUT_A
INIT_HEAP
TEST_ARRAY OUT_A !
OUT_A @ .
  `;

  try {
      forth.interpret(codeToRun);
  } catch (e) {
      console.log(e);
  }
}
main();
