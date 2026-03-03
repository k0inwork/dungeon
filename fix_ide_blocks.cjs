const fs = require('fs');

let content = fs.readFileSync('src/components/ForthIDE.tsx', 'utf8');

content = content.replace(
  /proc\.log\("--- LOADING FIRMWARE ---"\);\n        proc\.run\(STANDARD_KERNEL_FIRMWARE\.join\("\\n"\)\);/g,
  `proc.log("--- LOADING FIRMWARE ---");
        proc.logicBlocks = STANDARD_KERNEL_FIRMWARE.slice(); // Reset and copy firmware
        proc.run(STANDARD_KERNEL_FIRMWARE.join("\\n"));`
);

fs.writeFileSync('src/components/ForthIDE.tsx', content);
