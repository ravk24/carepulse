import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { createUser } from "@/lib/actions/patient.actions";
import { uniqueEmail } from "../support/factories";

// API: HTTP error responses of the backend API the app talks to (Supabase's PostgREST at /rest/v1).
// CarePulse has no REST API of its own (it uses Server Actions), so this is where 400/401/403/404/409
// actually happen. Each test pins the status code AND the Postgres/PostgREST error code, then (where it
// applies) checks that the app turns the error into something sensible.

const REST = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const asService = { apikey: SERVICE, authorization: `Bearer ${SERVICE}` };
const asAnon = { apikey: ANON };
const json = { "content-type": "application/json" };

const call = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${REST}${path}`, init);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const newUserRow = (email = uniqueEmail("api")) => ({ name: "API Test", email, phone: "+15551234567" });

const createdEmails: string[] = [];
afterAll(async () => {
  for (const email of createdEmails) {
    await call(`/users?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: asService });
  }
});

describe("Supabase REST API error responses (API)", () => {
  it("API-01 400 Bad Request: a malformed id is rejected by the database, not silently ignored", async () => {
    const { status, body } = await call("/users?id=eq.not-a-uuid", { headers: asService });
    expect(status).toBe(400);
    expect(body.code).toBe("22P02"); // invalid_text_representation
  });

  it("API-02 400 Bad Request: an appointment missing required fields is refused", async () => {
    const { status, body } = await call("/appointments", {
      method: "POST",
      headers: { ...asService, ...json },
      body: JSON.stringify({ userId: randomUUID() }),
    });
    expect(status).toBe(400);
    expect(body.code).toBe("23502"); // not_null_violation
  });

  it("API-03 401 Unauthorized: the public anon key cannot write any table (RLS)", async () => {
    const { status, body } = await call("/users", {
      method: "POST",
      headers: { ...asAnon, ...json },
      body: JSON.stringify(newUserRow()),
    });
    expect(status).toBe(401);
    expect(body.code).toBe("42501"); // insufficient_privilege: row-level security
  });

  it("API-04 403 Forbidden: a signed-in (authenticated) non-admin cannot write either", async () => {
    const login = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { ...asAnon, ...json },
      body: JSON.stringify({ email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD }),
    });
    const { access_token } = await login.json();

    const { status, body } = await call("/users", {
      method: "POST",
      headers: { ...asAnon, authorization: `Bearer ${access_token}`, ...json },
      body: JSON.stringify(newUserRow()),
    });
    expect(status).toBe(403); // known identity, but not allowed (vs. 401 = unknown identity)
    expect(body.code).toBe("42501");
  });

  it("API-05 anon reads return 200 with NO rows: patient data never leaks to the public key", async () => {
    await createUser(newUserRow()).then((u) => createdEmails.push(u.email));

    for (const table of ["users", "patients", "appointments"]) {
      const { status, body } = await call(`/${table}?select=*`, { headers: asAnon });
      expect(status, table).toBe(200);
      expect(body, table).toEqual([]); // RLS filters rows out instead of erroring
    }
  });

  it("API-06 404 Not Found: an unknown table", async () => {
    const { status, body } = await call("/doctors", { headers: asService });
    expect(status).toBe(404);
    expect(body.code).toBe("PGRST205");
  });

  it("API-07 409 Conflict: a duplicate email violates the unique constraint ...", async () => {
    const row = newUserRow();
    createdEmails.push(row.email);
    const post = () =>
      call("/users", { method: "POST", headers: { ...asService, ...json }, body: JSON.stringify(row) });

    expect((await post()).status).toBe(201);
    const second = await post();
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("23505"); // unique_violation
  });

  it("API-08 ... and the app turns that 409 into 'reuse the existing user' (no error for the patient)", async () => {
    const row = newUserRow();
    createdEmails.push(row.email);

    const first = await createUser(row);
    const second = await createUser({ ...row, name: "Someone Typing Again" });
    expect(second.$id).toBe(first.$id);
  });

  it("API-09 found, not fixed: a request WITHOUT any API key gets 200 [] locally, not 401", async () => {
    // Hosted Supabase answers 401 "No API key found". The local stack lets it through as the anon role.
    // Harmless here (RLS returns no rows), but don't rely on "no key = 401" when testing locally.
    const { status, body } = await call("/users?select=id");
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});
