const fs = require('fs');

let content = fs.readFileSync('src/compiler/AetherTranspiler.ts', 'utf8');

// Update emitGlobals to store variables in lastSymbolTable
const emitGlobalsReplacement = `
  private static emitGlobals() {
    this.emit("( --- AETHER AUTO-GLOBALS --- )");

    // 0. Channel Initialization Flag
    this.emit("VARIABLE CHANNELS_INITED");
    this.emit("0 CHANNELS_INITED !");

    // 0.1 Initialize Heap
    this.emit("INIT_HEAP");

    // 1. Emit simple constants first
    this.globalConsts.forEach((init, rawName) => {
      const name = this.sanitizeName(rawName);
      if (this.isStructArray(rawName)) return;

      if (this.debugMode >= 1) this.lastSymbolTable.set(rawName, name);
      if (typeof init.value === 'number' || typeof init.value === 'boolean') {
          const val = init.value === true ? -1 : (init.value === false ? 0 : init.value);
          this.emit(\`\${val} CONSTANT \${name}\`);
      }
    });

    // 2. Emit global variables and dynamic arrays
    this.globalVars.forEach(rawV => {
      const v = this.sanitizeName(rawV);
      if (this.debugMode >= 1) this.lastSymbolTable.set(rawV, v);

      if (this.isStructArray(rawV)) {
          const structName = this.getStructType(rawV);
          const count = this.structArrayCounts.get(rawV) || 0;

          if (count === 0 && this.globalConsts.has(rawV)) {
               const constInit = this.globalConsts.get(rawV);
               this.emit(\`\${constInit.value} CONSTANT \${v}\`);
          } else {
               this.emit(\`CREATE \${v} \${count} SIZEOF_\${structName?.toUpperCase()} * ALLOT\`);
          }

          const entry = AetherTranspiler.globalExportRegistry.get(structName!);
          if (entry && entry.owner === this.currentKernelId && entry.varName === rawV) {
              this.emit(\`\${v} \${entry.typeId} \${entry.sizeBytes} JS_REGISTER_VSO\`);
          }
      } else {
          this.emit(\`VARIABLE \${v}\`);
      }
    });

    // 3. Emit struct arrays that were declared as 'const'
    this.globalConsts.forEach((init, rawName) => {
        if (!this.isStructArray(rawName)) return;
        if (this.globalVars.has(rawName)) return; // Already emitted

        const name = this.sanitizeName(rawName);
        if (this.debugMode >= 1) this.lastSymbolTable.set(rawName, name);
        const structName = this.getStructType(rawName);
        const count = this.structArrayCounts.get(rawName) || 0;
        this.emit(\`CREATE \${name} \${count} SIZEOF_\${structName?.toUpperCase()} * ALLOT\`);

        const entry = AetherTranspiler.globalExportRegistry.get(structName!);
        if (entry && entry.owner === this.currentKernelId && entry.varName === rawName) {
            this.emit(\`\${name} \${entry.typeId} \${entry.sizeBytes} JS_REGISTER_VSO\`);
        }
    });

    // 4. Emit Local Variables
    this.scopes.forEach(scope => {
      scope.args.forEach(arg => {
        const fullName = this.sanitizeName(\`LV_\${scope.functionName}_\${arg}\`);
        if (this.debugMode >= 1) this.lastSymbolTable.set(\`\${scope.functionName}::\${arg}\`, fullName);
        this.emit(\`VARIABLE \${fullName}\`);
      });
      scope.variables.forEach(v => {
        const rawFullName = \`LV_\${scope.functionName}_\${v}\`;
        const fullName = this.sanitizeName(rawFullName);
        if (this.debugMode >= 1) this.lastSymbolTable.set(\`\${scope.functionName}::\${v}\`, fullName);
        if (this.isStructArray(rawFullName)) {
            const structName = this.getStructType(rawFullName);
            const count = this.structArrayCounts.get(rawFullName) || 0;
            this.emit(\`CREATE \${fullName} \${count} SIZEOF_\${structName?.toUpperCase()} * ALLOT\`);

            const entry = AetherTranspiler.globalExportRegistry.get(structName!);
            if (entry && entry.owner === this.currentKernelId && entry.varName === rawFullName) {
                this.emit(\`\${fullName} \${entry.typeId} \${entry.sizeBytes} JS_REGISTER_VSO\`);
            }
        } else {
            this.emit(\`VARIABLE \${fullName}\`);
        }
      });
    });
    this.emit("( ------------------------- )");
  }
`;

content = content.replace(/  private static emitGlobals\(\) \{[\s\S]*?  \/\/ --- PASS 2: COMPILATION ---/m, emitGlobalsReplacement.trim() + "\n\n  // --- PASS 2: COMPILATION ---");

fs.writeFileSync('src/compiler/AetherTranspiler.ts', content);
