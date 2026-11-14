import { createHmac } from "node:crypto";

import { createClient, type Session } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getAppointment, updateAppointment } from "@/lib/actions/appointment.actions";
import { getAdminUser } from "@/lib/auth";
import { cookieJar } from "../support/cookies";
import { makeAppointment } from "../support/factories";

// SEC: the admin check against attacks on the session token (a JWT in the sb-127-auth-token cookie).
// Each test puts a manipulated session into the cookie jar, exactly like an attacker editing their own
// browser cookie, and checks that getAdminUser() (used by the admin page and every admin server action)
// says "no".

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const COOKIE = "sb-127-auth-token"; // @supabase/ssr: "sb-<first part of the host>-auth-token"

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const claimsOf = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
const signHs256 = (claims: object, secret = process.env.TEST_SUPABASE_JWT_SECRET!) => {
  const data = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(claims)}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
};

// A real session straight from the Auth server (not through signInAdmin, which signs non-admins out)
async function realSession(email: string, password: string): Promise<Session> {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session!;
}
const adminSession = () => realSession(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
const userSession = () => realSession(process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);

// Same encoding @supabase/ssr uses: "base64-" + base64url(JSON of the session)
const putSessionCookie = (session: object) =>
  cookieJar.set(COOKIE, `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`);

// What the Auth server itself says about a token (to document WHY the app rejects it)
const authServerSays = async (jwt: string) => {
  const res = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
};

describe("JWT authentication and role-based access (SEC)", () => {
  it("SEC-01 control: an untouched admin session is accepted", async () => {
    putSessionCookie(await adminSession());
    expect((await getAdminUser())?.email).toBe(process.env.TEST_ADMIN_EMAIL);
  });

  it("SEC-02 a non-admin who edits the token payload to role=admin is rejected (signature no longer matches)", async () => {
    const session = await userSession();
    const [header, , signature] = session.access_token.split(".");
    const claims = claimsOf(session.access_token);
    const tampered = `${header}.${b64url({ ...claims, app_metadata: { ...claims.app_metadata, role: "admin" } })}.${signature}`;

    expect(await authServerSays(tampered)).toMatchObject({ status: 403, body: { error_code: "bad_jwt" } });

    putSessionCookie({ ...session, access_token: tampered, user: { ...session.user, app_metadata: { role: "admin" } } });
    expect(await getAdminUser()).toBeNull();

    // ...and the real damage check: an admin-only action changes nothing
    const { user, appointment } = await makeAppointment();
    const result = await updateAppointment({
      appointmentId: appointment.$id,
      userId: user.$id,
      timeZone: "UTC",
      type: "cancel",
      appointment: { status: "cancelled", cancellationReason: "forged" } as any,
    });
    expect(result.error).toMatch(/Unauthorized/);
    expect((await getAppointment(appointment.$id)).status).toBe("pending");
  });

  it("SEC-03 a CORRECTLY signed token that claims admin is still rejected: the role comes from the database, not the token", async () => {
    const session = await userSession();
    const forged = signHs256({ ...claimsOf(session.access_token), app_metadata: { role: "admin" } });

    // The Auth server accepts the signature (legacy HS256 secret)...
    const { status, body } = await authServerSays(forged);
    expect(status).toBe(200);
    // ...but answers with the user as stored in the database, without the forged role
    expect(body.app_metadata.role).toBeUndefined();

    putSessionCookie({ ...session, access_token: forged, user: { ...session.user, app_metadata: { role: "admin" } } });
    expect(await getAdminUser()).toBeNull();
  });

  it("SEC-04 an expired admin token is rejected when it can't be refreshed", async () => {
    const session = await adminSession();
    const exp = Math.floor(Date.now() / 1000) - 60;
    const expired = signHs256({ ...claimsOf(session.access_token), exp });

    expect(await authServerSays(expired)).toMatchObject({ status: 403, body: { error_code: "bad_jwt" } });

    putSessionCookie({ ...session, access_token: expired, expires_at: exp, refresh_token: "not-a-real-refresh-token" });
    expect(await getAdminUser()).toBeNull();
  });

  it("SEC-05 a signed-out (revoked) admin session can't be reused", async () => {
    const session = await adminSession();
    // Revoke only THIS session (scope=local), so parallel tests using the same admin are unaffected
    const out = await fetch(`${URL_}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: ANON, authorization: `Bearer ${session.access_token}` },
    });
    expect(out.status).toBe(204);

    // The token itself is still unexpired and correctly signed, but its session is gone
    expect(await authServerSays(session.access_token)).toMatchObject({
      status: 403,
      body: { error_code: "session_not_found" },
    });

    putSessionCookie(session); // the attacker replays the old cookie
    expect(await getAdminUser()).toBeNull();
  });

  it("SEC-06 an unsigned token (alg: none) is rejected", async () => {
    const session = await adminSession();
    const unsigned = `${b64url({ alg: "none", typ: "JWT" })}.${b64url(claimsOf(session.access_token))}.`;

    expect(await authServerSays(unsigned)).toMatchObject({ status: 403, body: { error_code: "bad_jwt" } });

    putSessionCookie({ ...session, access_token: unsigned, refresh_token: "nope" });
    expect(await getAdminUser()).toBeNull();
  });

  it("SEC-07 a token signed with the wrong secret is rejected", async () => {
    const session = await adminSession();
    const wrong = signHs256(claimsOf(session.access_token), "an-attacker-guessed-this-secret-0123456789");

    expect(await authServerSays(wrong)).toMatchObject({ status: 403, body: { error_code: "bad_jwt" } });

    putSessionCookie({ ...session, access_token: wrong, refresh_token: "nope" });
    expect(await getAdminUser()).toBeNull();
  });

  it("SEC-08 a garbage cookie doesn't crash the check, it just means 'not signed in'", async () => {
    cookieJar.set(COOKIE, "base64-this-is-not-json");
    await expect(getAdminUser()).resolves.toBeNull();
  });
});
