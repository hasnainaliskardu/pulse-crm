// Extract the stored GitHub credential from Windows Credential Manager
const { execSync } = require("child_process");

const out = execSync('cmdkey /list', { encoding: "utf8" });
const targets = [...out.matchAll(/Target:\s*(.+)/g)].map((m) => m[1].trim());
console.log(JSON.stringify(targets));
