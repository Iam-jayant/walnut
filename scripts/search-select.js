const fs = require("fs");
const path = require("path");

const fhePath = path.join(__dirname, "../node_modules/@fhenixprotocol/cofhe-contracts/FHE.sol");
const content = fs.readFileSync(fhePath, "utf8");
const lines = content.split("\n");

console.log("=== FHE.select / math implementations in FHE.sol ===");
let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("select(") && lines[i].includes("internal")) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 8); j++) {
      console.log(`  [${j + 1}] ${lines[j]}`);
    }
    count++;
    if (count > 5) break;
  }
}
