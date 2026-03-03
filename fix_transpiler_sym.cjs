const fs = require('fs');

let content = fs.readFileSync('src/compiler/AetherTranspiler.ts', 'utf8');

// Add lastSymbolTable property
content = content.replace(
  /private static debugMode: number = 0; \/\/ 0=off, 1=symbols, 2=trace/g,
  "private static debugMode: number = 0; // 0=off, 1=symbols, 2=trace\n  static lastSymbolTable: Map<string, string> = new Map();"
);

// Populate lastSymbolTable during transpile
content = content.replace(
  /this\.loadVsoRegistry\(\);/g,
  "this.loadVsoRegistry();\n    this.lastSymbolTable = new Map();"
);

// We need to capture variables. They are declared in emit().
// Let's just capture 'VARIABLE' declarations or CONSTANTs.
// Actually, the IDE expects AJS variable name -> Forth variable name mapping.
// Let's hook into `declareVariable` or similar. Wait, does AetherTranspiler have `declareVariable`?
fs.writeFileSync('src/compiler/AetherTranspiler.ts', content);
