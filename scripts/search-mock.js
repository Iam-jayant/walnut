const fs = require("fs");
const path = require("path");

const mockPath = path.join(__dirname, "../node_modules/@cofhe/mock-contracts/contracts/MockTaskManager.sol");
if (!fs.existsSync(mockPath)) {
  console.log("MockTaskManager.sol not found at:", mockPath);
  process.exit(1);
}

const content = fs.readFileSync(mockPath, "utf8");
const lines = content.split("\n");

console.log("Searching in MockTaskManager.sol...");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().includes("verifyinput") || lines[i].includes("Signer") || lines[i].toLowerCase().includes("invalid")) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
  }
}
