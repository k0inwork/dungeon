const fs = require('fs');

let content = fs.readFileSync('src/compiler/AetherTranspiler.ts', 'utf8');

// I accidentally duplicated the variables instead of replacing them in my string replace.
// Let's do a clean reset of emitGlobals from git and apply the logic cleanly.
const originalContent = require('child_process').execSync('git show HEAD:src/compiler/AetherTranspiler.ts', { encoding: 'utf8' });

const startIdx = originalContent.indexOf('  private static emitGlobals() {');
const endIdx = originalContent.indexOf('  // --- PASS 2: COMPILATION ---');

let originalEmitGlobals = originalContent.substring(startIdx, endIdx);

// cleanly replace logic
originalEmitGlobals = originalEmitGlobals.replace(
  /    this\.globalConsts\.forEach\(\(init, rawName\) => \{/g,
  `    this.globalConsts.forEach((init, rawName) => {
      const symName = this.sanitizeName(rawName);
      if (this.debugMode >= 1) this.lastSymbolTable.set(rawName, symName);`
);

originalEmitGlobals = originalEmitGlobals.replace(
  /    this\.globalVars\.forEach\(rawV => \{/g,
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

// One of the replaces duplicated `const name = this.sanitizeName(rawName);`
// Let's manually deduplicate these lines if they exist

content = content.replace(/      const v = this\.sanitizeName\(rawV\);\n      if \(this\.debugMode >= 1\) this\.lastSymbolTable\.set\(rawV, v\);\n      if \(KNOWN_GLOBALS\.has\(rawV\)\) return; \/\/ Skip firmware globals\n      const v = this\.sanitizeName\(rawV\);/g,
"      const v = this.sanitizeName(rawV);\n      if (this.debugMode >= 1) this.lastSymbolTable.set(rawV, v);\n      if (KNOWN_GLOBALS.has(rawV)) return; // Skip firmware globals");

content = content.replace(/        const fullName = this\.sanitizeName\(\`LV_\$\{scope\.functionName\}_\$\{arg\}\`\);\n        if \(this\.debugMode >= 1\) this\.lastSymbolTable\.set\(\`\$\{scope\.functionName\}::\$\{arg\}\`, fullName\);\n        const fullName = this\.sanitizeName\(\`LV_\$\{scope\.functionName\}_\$\{arg\}\`\);/g,
"        const fullName = this.sanitizeName(`LV_${scope.functionName}_${arg}`);\n        if (this.debugMode >= 1) this.lastSymbolTable.set(`${scope.functionName}::${arg}`, fullName);");

content = content.replace(/        const rawFullName = \`LV_\$\{scope\.functionName\}_\$\{v\}\`;\n        const fullName = this\.sanitizeName\(rawFullName\);\n        if \(this\.debugMode >= 1\) this\.lastSymbolTable\.set\(\`\$\{scope\.functionName\}::\$\{v\}\`, fullName\);\n        const rawFullName = \`LV_\$\{scope\.functionName\}_\$\{v\}\`;\n        const fullName = this\.sanitizeName\(rawFullName\);/g,
"        const rawFullName = `LV_${scope.functionName}_${v}`;\n        const fullName = this.sanitizeName(rawFullName);\n        if (this.debugMode >= 1) this.lastSymbolTable.set(`${scope.functionName}::${v}`, fullName);");

content = content.replace(/        const name = this\.sanitizeName\(rawName\);\n        if \(this\.debugMode >= 1\) this\.lastSymbolTable\.set\(rawName, name\);\n        const name = this\.sanitizeName\(rawName\);/g,
"        const name = this.sanitizeName(rawName);\n        if (this.debugMode >= 1) this.lastSymbolTable.set(rawName, name);");


fs.writeFileSync('src/compiler/AetherTranspiler.ts', content);
