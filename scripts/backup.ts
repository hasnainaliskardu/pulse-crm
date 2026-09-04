/**
 * Daily JSON snapshot of all tables → Supabase "backups" bucket (keeps last 30).
 * Usage: npm run backup   (requires SUPABASE_SERVICE_ROLE_KEY + URL)
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const TABLES = [
  "members", "leads", "touches", "tasks", "notes", "files",
  "clients", "daily_stats", "targets", "activity_log",
  "custom_fields", "custom_field_values", "workflow_rules",
] as const;

async function main() {
  const stamp = new Date().toISOString().slice(0, 10);
  const snapshot: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    const { data, error } = await admin.from(table).select("*").limit(100_000);
    if (error) {
      console.warn(`Skipping ${table}: ${error.message}`);
      continue;
    }
    snapshot[table] = data ?? [];
  }

  mkdirSync("backups", { recursive: true });
  const path = `backups/hana-${stamp}.json`;
  writeFileSync(path, JSON.stringify({ exported_at: new Date().toISOString(), tables: snapshot }, null, 2));

  // ensure bucket exists (ignore error if it does)
  await admin.storage.createBucket("backups", { public: false }).catch(() => {});

  const { error: upErr } = await admin.storage
    .from("backups")
    .upload(`backups/hana-${stamp}.json`, JSON.stringify(snapshot), {
      contentType: "application/json",
      upsert: true,
    } as never);
  if (upErr) {
    console.warn("Upload to bucket failed (local file kept):", upErr.message);
  } else {
    // prune: keep last 30
    const { data: files } = await admin.storage.from("backups").list("backups");
    const names = (files ?? []).map((f) => f.name).sort();
    for (const name of names.slice(0, Math.max(0, names.length - 30))) {
      await admin.storage.from("backups").remove([`backups/${name}`]);
    }
  }

  console.log(`Backup complete: ${path}`);
}

main();
