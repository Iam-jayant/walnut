const fs = require("fs");
const path = require("path");

const mockPath = path.join(__dirname, "../node_modules/@cofhe/mock-contracts/contracts/MockTaskManager.sol");
const content = fs.readFileSync(mockPath, "utf8");
const lines = content.split("\n");

console.log("=== createDecryptTask in MockTaskManager.sol ===");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("createDecryptTask")) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 15); j++) {
      console.log(`  [${j + 1}] ${lines[j]}`);
    }
  }
}
