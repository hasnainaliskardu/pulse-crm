// Create the GitHub repo via API and print its URL
const { spawnSync } = require("child_process");

const input = "protocol=https\nhost=github.com\n\n";
const cred = spawnSync("git", ["credential", "fill"], { input, encoding: "utf8", timeout: 15000 });
const lines = cred.stdout.split("\n").filter(Boolean);
const map = {};
for (const l of lines) {
  const idx = l.indexOf("=");
  if (idx > 0) map[l.slice(0, idx)] = l.slice(idx + 1);
}
const token = map.password;
const user = map.username;

// 1. whoami — confirm token works
const who = spawnSync("curl", ["-s", "-H", `Authorization: Bearer ${token}`, "https://api.github.com/user"], { encoding: "utf8", timeout: 30000 });
const whoData = JSON.parse(who.stdout || "{}");
if (!whoData.login) {
  console.log("TOKEN_INVALID:" + who.stdout.slice(0, 200));
  process.exit(1);
}
console.log("USER:" + whoData.login);

// 2. create public repo
const create = spawnSync("curl", [
  "-s", "-X", "POST",
  "-H", `Authorization: Bearer ${token}`,
  "-H", "Accept: application/vnd.github+json",
  "https://api.github.com/user/repos",
  "-d", JSON.stringify({ name: "pulse-crm", description: "Pulse CRM — offline-first outreach & cold-calling CRM (Next.js 14 + Supabase + Dexie)", private: false, has_issues: true }),
], { encoding: "utf8", timeout: 30000 });
const created = JSON.parse(create.stdout || "{}");
if (created.html_url) {
  console.log("REPO:" + created.html_url);
} else {
  console.log("CREATE_RESPONSE:" + create.stdout.slice(0, 300));
}
