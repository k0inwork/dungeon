const fs = require('fs');

let content = fs.readFileSync('src/components/ForthIDE.tsx', 'utf8');

const replacement = `
  // Update symbol table when transpiling
  useEffect(() => {
      if (mode === "ATTACH" && attachedInstanceId) {
          if (attachedInstanceId.includes("GRID") || attachedInstanceId.startsWith("10")) setSymbolTable(GRID_SYMBOL_TABLE);
          else if (attachedInstanceId.includes("PLAYER") || attachedInstanceId === "2") setSymbolTable(PLAYER_SYMBOL_TABLE);
          else if (attachedInstanceId.includes("HIVE") || attachedInstanceId.startsWith("30")) setSymbolTable(HIVE_SYMBOL_TABLE);
          else if (attachedInstanceId.includes("BATTLE") || attachedInstanceId.startsWith("40")) setSymbolTable(BATTLE_SYMBOL_TABLE);
          else setSymbolTable(new Map());
      }
  }, [mode, attachedInstanceId]);
`;

content = content.replace(
    /\/\/ Update symbol table when transpiling[\s\S]*?\}, \[mode, attachedInstanceId, ajsCode\]\);/,
    replacement.trim()
);

fs.writeFileSync('src/components/ForthIDE.tsx', content);
