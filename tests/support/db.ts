import { Pool } from "pg";

// Raw SQL access to the LOCAL Supabase Postgres, for backend data checks that go around the API.
// Connects as the `postgres` superuser, so it sees every row regardless of RLS.
const url = process.env.TEST_DATABASE_URL!;
if (!/@(127\.0\.0\.1|localhost):/.test(url ?? "")) {
  throw new Error(`Refusing to run SQL checks against a non-local database (${url})`);
}

export const db = new Pool({ connectionString: url, max: 2 });

// Parameterized query returning the rows ($1, $2 … placeholders, never string concatenation)
export const sql = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  (await db.query(text, params)).rows as T[];
