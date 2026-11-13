import { ensureTestUsers } from "./admin";

// Runs once before all integration test files (in the main Vitest process).
export default async function setup() {
  process.loadEnvFile(".env.test");

  // Fail fast with a helpful message instead of 50 confusing "fetch failed" errors
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`);
  } catch {
    throw new Error("Local Supabase is not running. Start it with `npm run db:test:start` (needs Docker).");
  }

  await ensureTestUsers();
}
