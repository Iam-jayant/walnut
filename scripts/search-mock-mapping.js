const fs = require("fs");
const path = require("path");

const mockPath = path.join(__dirname, "../node_modules/@cofhe/mock-contracts/contracts/MockTaskManager.sol");
const content = fs.readFileSync(mockPath, "utf8");
const lines = content.split("\n");

console.log("=== mappings and storage in MockTaskManager.sol ===");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("mapping") || lines[i].includes("struct") || lines[i].toLowerCase().includes("result")) {
    if (lines[i].includes("function") || lines[i].includes("event")) continue;
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
  }
}
