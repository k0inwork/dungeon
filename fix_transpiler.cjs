const fs = require('fs');

let content = fs.readFileSync('src/compiler/AetherTranspiler.ts', 'utf8');

content = content.replace(
  /private static debugMode: boolean = false;/g,
  "private static debugMode: number = 0; // 0=off, 1=symbols, 2=trace"
);

content = content.replace(
  /static transpile\(jsCode: string, kernelId: number = 0, debugMode: boolean = false\): string \{/g,
  "static transpile(jsCode: string, kernelId: number = 0, debugMode: number | boolean = false): string {"
);

content = content.replace(
  /this\.debugMode = debugMode;/g,
  `this.debugMode = typeof debugMode === 'boolean' ? (debugMode ? 2 : 0) : debugMode;`
);

content = content.replace(
  /if \(this\.debugMode\)/g,
  "if (this.debugMode >= 2)"
);

// We need to keep symbol tracking active if debugMode >= 1
// Right now, symbolTable tracks symbols anyway (lastSymbolTable)
// Let's check how lastSymbolTable is used.
fs.writeFileSync('src/compiler/AetherTranspiler.ts', content);
