const fs = require('fs');

const files = [
  'src/kernels/BattleKernel.ts',
  'src/kernels/HiveKernel.ts',
  'src/kernels/PlayerKernel.ts',
  'src/kernels/GridKernel.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /const IS_DEBUG = typeof window !== 'undefined' \? new URLSearchParams\(window\.location\.search\)\.has\('debug'\) : false;/g,
    `const getDebugLevel = () => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('debug')) return 0;
    const val = params.get('debug');
    if (val === 'true' || val === '') return 2; // Default to full trace if ?debug or ?debug=true
    return parseInt(val || '0', 10);
};
const IS_DEBUG = getDebugLevel();`
  );

  // Expose symbol table statically
  // We will transpile first to get the source, then get the symbols
  // Actually, AetherTranspiler.transpile runs immediately on module load.
  // We can just add an export for the symbol table!
  const blockName = file.match(/([a-zA-Z]+)Kernel\.ts/)[1].toUpperCase() + "_KERNEL_BLOCKS";
  const ajsSource = file.match(/([a-zA-Z]+)Kernel\.ts/)[1].toUpperCase() + "_AJS_SOURCE";

  // append the symbol export
  if (!content.includes('export const ' + file.match(/([a-zA-Z]+)Kernel\.ts/)[1].toUpperCase() + '_SYMBOL_TABLE')) {
     content += `\nexport const ${file.match(/([a-zA-Z]+)Kernel\.ts/)[1].toUpperCase()}_SYMBOL_TABLE = AetherTranspiler.lastSymbolTable;\n`;
  }

  fs.writeFileSync(file, content);
}
