const fs = require('fs');

let content = fs.readFileSync('src/compiler/AetherTranspiler.ts', 'utf8');

// We will fetch the original `emitGlobals` logic from git and splice in the `lastSymbolTable` logic.
const originalContent = require('child_process').execSync('git show HEAD:src/compiler/AetherTranspiler.ts', { encoding: 'utf8' });

const startIdx = originalContent.indexOf('  private static emitGlobals() {');
const endIdx = originalContent.indexOf('  // --- PASS 2: COMPILATION ---');

if (startIdx === -1 || endIdx === -1) throw new Error("Could not find emitGlobals in original");

let originalEmitGlobals = originalContent.substring(startIdx, endIdx);

// Add the symbol table insertions back into the original text
originalEmitGlobals = originalEmitGlobals.replace(
  /    this\.globalConsts\.forEach\(\(init, rawName\) => \{/g,
  `    this.globalConsts.forEach((init, rawName) => {
      const symName = this.sanitizeName(rawName);
      if (this.debugMode >= 1) this.lastSymbolTable.set(rawName, symName);`
);

originalEmitGlobals = originalEmitGlobals.replace(
  /    this\.globalVars\.forEach\((rawV|v) => \{/g,
  `    this.globalVars.forEach(rawV => {
      const v = this.sanitizeName(rawV);
      if (this.debugMode >= 1) this.lastSymbolTable.set(rawV, v);`
);

originalEmitGlobals = originalEmitGlobals.replace(
  /        const name = this\.sanitizeName\(rawName\);/g,
  `        const name = this.sanitizeName(rawName);
        if (this.debugMode >= 1) this.lastSymbolTable.set(rawName, name);`
);

originalEmitGlobals = originalEmitGlobals.replace(
  /      scope\.args\.forEach\(arg => \{/g,
  `      scope.args.forEach(arg => {
        const fullName = this.sanitizeName(\`LV_\${scope.functionName}_\${arg}\`);
        if (this.debugMode >= 1) this.lastSymbolTable.set(\`\${scope.functionName}::\${arg}\`, fullName);`
);

originalEmitGlobals = originalEmitGlobals.replace(
  /      scope\.variables\.forEach\(v => \{/g,
  `      scope.variables.forEach(v => {
        const rawFullName = \`LV_\${scope.functionName}_\${v}\`;
        const fullName = this.sanitizeName(rawFullName);
        if (this.debugMode >= 1) this.lastSymbolTable.set(\`\${scope.functionName}::\${v}\`, fullName);`
);

const currentStartIdx = content.indexOf('  private static emitGlobals() {');
const currentEndIdx = content.indexOf('  // --- PASS 2: COMPILATION ---');
content = content.substring(0, currentStartIdx) + originalEmitGlobals + content.substring(currentEndIdx);

fs.writeFileSync('src/compiler/AetherTranspiler.ts', content);
