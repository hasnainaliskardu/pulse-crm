import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. list auth users
const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
console.log("=== Auth users ===");
for (const u of users?.users ?? []) {
  console.log(u.email, "| confirmed:", u.email_confirmed_at ? "yes" : "NO", "| banned:", u.banned_until ?? "no", "| id:", u.id);
}

// 2. check members row
const { data: members, error: mErr } = await admin.from("members").select("*");
console.log("\n=== Members table ===");
console.log(mErr ? "ERROR: " + mErr.message : JSON.stringify(members, null, 2));

// 3. force-reset password for founder
const email = process.env.FOUNDER_EMAIL!;
const password = process.env.FOUNDER_PASSWORD!;
const existing = (users?.users ?? []).find((u) => u.email === email);

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  console.log("\n=== Password update ===");
  console.log(error ? "ERROR: " + error.message : "Password reset OK for " + email);

  // verify sign-in works
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: sig, error: sigErr } = await anon.auth.signInWithPassword({ email, password });
  console.log("\n=== Sign-in test ===");
  console.log(sigErr ? "SIGN-IN ERROR: " + sigErr.message : "SIGN-IN OK as " + sig.user?.email);
} else {
  console.log("\nNo auth user found for " + email);
}
}
main();
