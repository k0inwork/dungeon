const fs = require('fs');

let content = fs.readFileSync('src/components/ForthIDE.tsx', 'utf8');

content = content.replace(
  /proc\.run\(sourceToRun\);/g,
  "proc.run(sourceToRun);\n        proc.logicBlocks.push(sourceToRun);"
);

fs.writeFileSync('src/components/ForthIDE.tsx', content);
