// Read the stored GitHub credential via git credential helper (non-interactive)
const { execSync, spawnSync } = require("child_process");

// git credential fill expects protocol/host on stdin
const input = "protocol=https\nhost=github.com\n\n";
const res = spawnSync("git", ["credential", "fill"], { input, encoding: "utf8", timeout: 15000 });
if (res.status !== 0) {
  console.log("ERR:" + (res.stderr || res.stdout));
  process.exit(1);
}
const lines = res.stdout.split("\n").filter(Boolean);
const map = {};
for (const l of lines) {
  const idx = l.indexOf("=");
  if (idx > 0) map[l.slice(0, idx)] = l.slice(idx + 1);
}
console.log(JSON.stringify({ username: map.username, tokenLen: (map.password || "").length, tokenPrefix: (map.password || "").slice(0, 4) }));
