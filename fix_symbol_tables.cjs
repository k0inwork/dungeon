const fs = require('fs');

let content = fs.readFileSync('src/components/ForthIDE.tsx', 'utf8');

// The IDE currently relies on recompiling code to get the symbol table,
// but for standard kernel debugging, we can import the standard tables.
// Let's add imports and fallback to them if an instance is selected and it hasn't been locally recompiled.

content = content.replace(
    /import \{ AetherTranspiler \} from "\.\.\/compiler\/AetherTranspiler";/,
    `import { AetherTranspiler } from "../compiler/AetherTranspiler";\nimport { GRID_SYMBOL_TABLE } from "../kernels/GridKernel";\nimport { HIVE_SYMBOL_TABLE } from "../kernels/HiveKernel";\nimport { PLAYER_SYMBOL_TABLE } from "../kernels/PlayerKernel";\nimport { BATTLE_SYMBOL_TABLE } from "../kernels/BattleKernel";`
);

const symbolTableLogic = `
  // If attachedInstanceId changes, set default symbol table if not recompiled
  useEffect(() => {
      if (attachedInstanceId) {
          if (attachedInstanceId.includes("GRID") || attachedInstanceId.startsWith("10")) setSymbolTable(GRID_SYMBOL_TABLE);
          else if (attachedInstanceId.includes("PLAYER") || attachedInstanceId === "2") setSymbolTable(PLAYER_SYMBOL_TABLE);
          else if (attachedInstanceId.includes("HIVE") || attachedInstanceId.startsWith("30")) setSymbolTable(HIVE_SYMBOL_TABLE);
          else if (attachedInstanceId.includes("BATTLE") || attachedInstanceId.startsWith("40")) setSymbolTable(BATTLE_SYMBOL_TABLE);
          else setSymbolTable(new Map());
      }
  }, [attachedInstanceId]);
`;

// Insert the new logic inside the component.
// We'll replace the existing basic ajsCode useEffect which resets symbol table.
content = content.replace(
  /  useEffect\(\(\) => \{\n      if \(!ajsCode\) \{\n          \/\/ Realistically[\s\S]*?\}\n  \}, \[mode, attachedInstanceId, ajsCode\]\);/,
  symbolTableLogic.trim()
);

fs.writeFileSync('src/components/ForthIDE.tsx', content);
