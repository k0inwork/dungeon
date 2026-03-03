const fs = require('fs');

let content = fs.readFileSync('src/services/WaForthService.ts', 'utf8');

// Update isWordDefined to silence console.error
const isWordDefinedReplacement = `
  isWordDefined(wordName: string): boolean {
    if (!this.forth || this.status === "FLASHED") return false;
    const oldEmit = this.forth.onEmit;
    this.forth.onEmit = () => {}; // Mute output during check

    // Mute console.error because WAForth uses it for "undefined word"
    const oldConsoleError = console.error;
    console.error = () => {};

    try {
        this.forth.interpret(\`' \${wordName} DROP\`);
        this.forth.onEmit = oldEmit;
        console.error = oldConsoleError;
        return true;
    } catch (e) {
        this.forth.onEmit = oldEmit;
        console.error = oldConsoleError;
        return false;
    }
  }
`;

content = content.replace(/  isWordDefined\(wordName: string\): boolean {[\s\S]*?    }\n  }/m, isWordDefinedReplacement.trim());

// Update process.env.VITEST to be safe for browser
content = content.replace(
  /typeof process !== 'undefined' && process\.env\.VITEST/g,
  "(typeof process !== 'undefined' && process.env && process.env.VITEST)"
);

fs.writeFileSync('src/services/WaForthService.ts', content);
