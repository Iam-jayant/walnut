const fs = require("fs");
const path = require("path");

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== "node_modules" && f !== ".git" && f !== ".next") {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const targets = ["778c67", "013a19", "778c67b9", "013a19c3"];

walkDir(path.join(__dirname, ".."), filePath => {
  if (filePath.endsWith(".json") || filePath.endsWith(".js") || filePath.endsWith(".ts") || filePath.endsWith(".sol") || filePath.endsWith(".env") || filePath.endsWith(".local")) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      for (const t of targets) {
        if (content.toLowerCase().includes(t.toLowerCase())) {
          console.log(`Found target "${t}" in file:`, filePath);
        }
      }
    } catch (e) {
      // ignore
    }
  }
});
