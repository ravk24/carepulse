import { expect, test } from "@playwright/test";

// API (app side): HTTP status codes of the Next.js app itself, checked with Playwright's `request`
// fixture (plain HTTP, no browser). SEC-09: the middleware layer of the admin check against a forged
// session cookie (the integration SEC tests cover the server-action layer).

test.describe("HTTP responses of the app", () => {
  test("API-10 200 OK: the home page", async ({ request }) => {
    expect((await request.get("/")).status()).toBe(200);
  });

  test("API-11 404 Not Found: an unknown route", async ({ request }) => {
    expect((await request.get("/this-page-does-not-exist")).status()).toBe(404);
  });

  test("API-12 not found: registering an unknown or malformed patient id", async ({ request }) => {
    // Used to show an empty registration form that could never be submitted (a "soft 404").
    // Now the page calls notFound(). The status is still 200: app/loading.tsx makes Next stream the
    // response, so the 200 header is already sent when notFound() runs. Next then streams the 404 page
    // and adds <meta name="robots" content="noindex">, which is what we can assert.
    for (const id of ["not-a-uuid", "00000000-0000-0000-0000-000000000000"]) {
      const res = await request.get(`/patients/${id}/register`);
      const html = await res.text();
      expect(res.status(), id).toBe(200);
      expect(html, id).toContain('<meta name="robots" content="noindex"/>');
      expect(html, id).toContain("could not be found");
      expect(html, id).not.toContain("Submit and Continue"); // no registration form
    }
  });

  test("API-13 307 redirect: /admin without a session goes to the sign-in modal", async ({ request }) => {
    const res = await request.get("/admin", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/\?admin=true$/);
  });

  test("API-14 404: calling a Server Action that doesn't exist", async ({ request }) => {
    const res = await request.post("/", {
      headers: { "Next-Action": "00".repeat(21), "Content-Type": "text/plain;charset=UTF-8" },
      data: "[]",
    });
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain("Server action not found");
  });

  test("API-15 405 Method Not Allowed: PUT on a page", async ({ request }) => {
    expect((await request.put("/")).status()).toBe(405);
  });
});

test("SEC-09 middleware: a non-admin cookie edited to role=admin can't open /admin", async ({ page, context, request, baseURL }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const login = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    data: { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD },
  });
  const session = await login.json();

  // Edit the JWT payload (role=admin) and the cached user, keep the original signature
  const [header, payload, signature] = session.access_token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  claims.app_metadata = { ...claims.app_metadata, role: "admin" };
  const forged = {
    ...session,
    access_token: `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`,
    user: { ...session.user, app_metadata: { role: "admin" } },
  };
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(forged)).toString("base64url")}`,
      url: baseURL!,
    },
  ]);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/\?admin=true$/);
  await expect(page.getByRole("alertdialog", { name: /Admin Sign In/ })).toBeVisible(); // the modal, not the dashboard
});
