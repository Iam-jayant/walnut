const fs = require("fs");
const path = require("path");

const dtsPath = path.join(__dirname, "../node_modules/@cofhe/sdk/dist/clientTypes-DDmcgZ0a.d.ts");
const content = fs.readFileSync(dtsPath, "utf8");
const lines = content.split("\n");

function findType(typeName) {
  console.log(`\n=== Searching for ${typeName} ===`);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`class ${typeName}`) || lines[i].includes(`type ${typeName}`) || lines[i].includes(`interface ${typeName}`)) {
      console.log(`Line ${i + 1}: ${lines[i].trim()}`);
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 15); j++) {
        console.log(`  [${j + 1}] ${lines[j]}`);
      }
    }
  }
}

findType("EncryptInputsBuilder");
findType("EncryptInputsResult");
findType("EncryptInputsOptions");
