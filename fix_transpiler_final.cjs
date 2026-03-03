const fs = require('fs');

let content = fs.readFileSync('src/compiler/AetherTranspiler.ts', 'utf8');

// Step 1: Add debugMode and lastSymbolTable state variables
content = content.replace(
  /private static debugMode: boolean = false;/g,
  "private static debugMode: number = 0; // 0=off, 1=symbols, 2=trace\n  static lastSymbolTable: Map<string, string> = new Map();"
);

// Step 2: Set debug mode intelligently and reset table
content = content.replace(
  /static transpile\(jsCode: string, kernelId: number = 0, debugMode: boolean = false\): string \{/g,
  "static transpile(jsCode: string, kernelId: number = 0, debugMode: number | boolean = false): string {"
);

content = content.replace(
  /this\.debugMode = debugMode;/g,
  `this.debugMode = typeof debugMode === 'boolean' ? (debugMode ? 2 : 0) : debugMode;`
);

content = content.replace(
  /this\.loadVsoRegistry\(\);/g,
  "this.loadVsoRegistry();\n    this.lastSymbolTable = new Map();"
);

content = content.replace(
  /if \(this\.debugMode\)/g,
  "if (this.debugMode >= 2)"
);

// Step 3: Inject lastSymbolTable.set logic directly into original emitGlobals
content = content.replace(
  /    this\.globalConsts\.forEach\(\(init, rawName\) => \{/g,
  `    this.globalConsts.forEach((init, rawName) => {
      const symName = this.sanitizeName(rawName);
      if (this.debugMode >= 1) this.lastSymbolTable.set(rawName, symName);`
);

content = content.replace(
  /    this\.globalVars\.forEach\((rawV|v) => \{/g,
  `    this.globalVars.forEach(rawV => {
      const v = this.sanitizeName(rawV);
      if (this.debugMode >= 1) this.lastSymbolTable.set(rawV, v);`
);

content = content.replace(
  /        const name = this\.sanitizeName\(rawName\);/g,
  `        const name = this.sanitizeName(rawName);
        if (this.debugMode >= 1) this.lastSymbolTable.set(rawName, name);`
);

content = content.replace(
  /      scope\.args\.forEach\(arg => \{/g,
  `      scope.args.forEach(arg => {
        const fullName = this.sanitizeName(\`LV_\${scope.functionName}_\${arg}\`);
        if (this.debugMode >= 1) this.lastSymbolTable.set(\`\${scope.functionName}::\${arg}\`, fullName);`
);

content = content.replace(
  /      scope\.variables\.forEach\(v => \{/g,
  `      scope.variables.forEach(v => {
        const rawFullName = \`LV_\${scope.functionName}_\${v}\`;
        const fullName = this.sanitizeName(rawFullName);
        if (this.debugMode >= 1) this.lastSymbolTable.set(\`\${scope.functionName}::\${v}\`, fullName);`
);

fs.writeFileSync('src/compiler/AetherTranspiler.ts', content);
