/**
 * Seed the founder account.
 * Usage: FOUNDER_EMAIL=... FOUNDER_PASSWORD=... npm run seed:founder
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.FOUNDER_EMAIL;
const password = process.env.FOUNDER_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error(
    "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOUNDER_EMAIL, FOUNDER_PASSWORD (e.g. in .env.local)."
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("FOUNDER_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // idempotent: look up existing auth user by email
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log("Auth user already exists, updating password.");
    await admin.auth.admin.updateUserById(userId, { password });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Founder" },
    });
    if (error || !data.user) {
      console.error("Failed to create auth user:", error?.message);
      process.exit(1);
    }
    userId = data.user.id;
  }

  const { error: memberError } = await admin.from("members").upsert(
    {
      id: userId,
      full_name: "Founder",
      email,
      position: "Manager",
      role: "FOUNDER",
      is_active: true,
      daily_research_target: 40,
      daily_touch_target: 45,
    },
    { onConflict: "id" }
  );
  if (memberError) {
    console.error("Failed to upsert member row:", memberError.message);
    process.exit(1);
  }

  console.log(`Founder seeded: ${email}`);
  process.exit(0);
}

main();
