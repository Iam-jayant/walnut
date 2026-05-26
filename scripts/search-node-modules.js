const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const targets = ["013a19", "778c67"];
const searchDirs = [
  path.join(__dirname, "../node_modules/@cofhe"),
  path.join(__dirname, "../node_modules/@fhenixprotocol")
];

searchDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    const files = walk(dir);
    files.forEach(file => {
      if (file.endsWith(".js") || file.endsWith(".json") || file.endsWith(".ts")) {
        try {
          const content = fs.readFileSync(file, "utf8");
          targets.forEach(target => {
            if (content.toLowerCase().includes(target.toLowerCase())) {
              console.log(`Found target "${target}" in file:`, file);
            }
          });
        } catch (e) {}
      }
    });
  }
});
