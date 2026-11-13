import { ensureTestUsers } from "../support/admin";

// Runs once before all E2E tests: make sure the test admin exists in the local Supabase
export default async function globalSetup() {
  await ensureTestUsers();
}
