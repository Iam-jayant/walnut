const fs = require("fs");
const path = require("path");

const dtsPath = path.join(__dirname, "../node_modules/@cofhe/react/dist/index.d.ts");
if (!fs.existsSync(dtsPath)) {
  console.log("dts file not found at:", dtsPath);
  process.exit(1);
}

const content = fs.readFileSync(dtsPath, "utf8");
const lines = content.split("\n");

console.log("Searching for useCofheEncrypt in index.d.ts...");
let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("useCofheEncrypt")) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
    // Print a few lines around it
    for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 10); j++) {
      console.log(`  [${j + 1}] ${lines[j]}`);
    }
    count++;
    if (count > 5) break;
  }
}
