const fs = require("fs");
const path = require("path");

const dtsPath = path.join(__dirname, "../node_modules/@cofhe/sdk/dist/clientTypes-DDmcgZ0a.d.ts");
const content = fs.readFileSync(dtsPath, "utf8");
const lines = content.split("\n");

console.log("=== ENCRYPT INPUTS BUILDER METHODS ===");
for (let i = 699; i < 760; i++) {
  console.log(`[${i + 1}] ${lines[i]}`);
}
