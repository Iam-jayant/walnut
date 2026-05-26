const fs = require("fs");
const path = require("path");

const mockPath = path.join(__dirname, "../node_modules/@cofhe/mock-contracts/contracts/MockTaskManager.sol");
const content = fs.readFileSync(mockPath, "utf8");
const lines = content.split("\n");

console.log("=== Top of MockTaskManager.sol ===");
for (let i = 0; i < 100; i++) {
  console.log(`[${i + 1}] ${lines[i]}`);
}
