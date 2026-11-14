# CarePulse – Practical Testing Exercises: Report

Status of the seven suggested exercises in this app. Updated **2026-11-14**, after adding the missing pieces.

| # | Exercise | Status | Where |
| --- | --- | --- | --- |
| 1 | Registration and login test suite | ✅ Done (before) | `tests/e2e/patient-booking.spec.ts`, `tests/e2e/admin.spec.ts`, component + integration tests |
| 2 | JWT authentication and role-based access | ✅ Done (JWT part **added today**) | `tests/integration/auth-jwt.int.test.ts` (SEC-01…08), `tests/e2e/http-status.spec.ts` (SEC-09) |
| 3 | API error responses (400/401/403/404/409/500) | ✅ Done, **added today** (500 not reproducible, see §3) | `tests/integration/api-errors.int.test.ts` (API-01…09), `tests/e2e/http-status.spec.ts` (API-10…15) |
| 4 | Parallel Playwright runs and retries | ✅ Done (before) | `playwright.config.ts` |
| 5 | AI-generated test cases, reviewed manually | ⚠️ Generated ✅ / **manual review is yours to do** | `testing_details.md` §3; checklist in §5 below |
| 6 | Investigate a deliberately introduced flaky test | ✅ Done, **added today** | `tests/e2e/flaky-demo.spec.ts` (FLK-01, FLK-02) |
| 7 | Visual baseline vs. a modified UI | ✅ Done, **added today** | `tests/e2e/visual.spec.ts` (VIS-01, 02), baselines in `tests/e2e/visual.spec.ts-snapshots/` |

**Bug fixed along the way:** `/patients/<unknown id>/register` showed an empty registration form that could
never be submitted (a "soft 404"). The page now calls `notFound()`
(`app/patients/[userId]/register/page.tsx`).

**Suite totals after today:** Vitest **145 passed** (unit + component + integration, coverage 94.8% lines /
84.5% branches, above all thresholds). Playwright **35 passed, 1 skipped** (FLK-01, skipped on purpose).
Lint and typecheck are clean.

---

## 1. Registration and login test suite ✅

This was already complete before today.

- **Registration (patients):** BK-01 is the full journey (Get Started → Register → Book → Success, then a database check).
  BK-02 reuses an existing email, BK-03/BK-04 cover the redirects, and VAL-10 blocks submission until consents are ticked.
  There are component tests for `PatientForm` and `RegisterForm`, plus integration tests for `createUser`,
  `registerPatient` and the redirects.
- **Login (admin):** UI-01 redirects a signed-out user to the modal. UI-02 signs in and shows the dashboard.
  UI-03 gives the same generic error for a wrong password and for a valid non-admin. UI-04 signs out and
  blocks `/admin` again. UI-05 sends a signed-in admin straight to `/admin`. There's a component test for
  `AdminLoginModal`.
- Patients have no passwords in this app (they only type their name, email and phone), so "login" exists only for admins.

---

## 2. JWT authentication and role-based access ✅

### What was already there (role-based access)
Admin means `app_metadata.role === "admin"`. It's checked in 3 places: middleware, the admin page, and every
admin server action (`assertAdmin`). BK-10 (non-admin rejected, nothing changed) and UI-01/UI-03 covered it.
A mutation check (deleting `assertAdmin()`) proved BK-10 catches it.

### Added today: attacks on the token itself
The session is a **JWT** stored in the `sb-127-auth-token` cookie (`base64-` + base64url-encoded JSON).
Each test puts a manipulated session into that cookie, like an attacker editing their own browser cookie,
and checks that `getAdminUser()` says no.

| ID | Attack | Auth server says | App result |
| --- | --- | --- | --- |
| SEC-01 | none (control) | 200 | admin ✅ |
| SEC-02 | Non-admin edits the payload to `role: admin`, keeps the old signature | 403 `bad_jwt` | rejected; the admin action changes nothing |
| SEC-03 | **Correctly signed** token (legacy HS256 secret) that claims admin | **200, accepted!** | rejected, because the role is read from the **database** user, not from the token |
| SEC-04 | Expired admin token + unusable refresh token | 403 `token is expired` | rejected |
| SEC-05 | Admin signs out, the old cookie is replayed (token still unexpired and validly signed) | 403 `session_not_found` | rejected |
| SEC-06 | Unsigned token (`alg: none`) | 403 `bad_jwt` | rejected |
| SEC-07 | Signed with a wrong secret | 403 `bad_jwt` | rejected |
| SEC-08 | Garbage cookie | – | "not signed in", no crash |
| SEC-09 (E2E) | Forged admin cookie in a real browser, against the **middleware** | – | `/admin` → redirected to the sign-in modal |

**Proving the tests are useful (mutation checks, reverted afterwards):**

| Deliberate bug in `lib/auth.ts` | Tests that failed |
| --- | --- |
| Trust the cookie: `getSession()` instead of `getUser()` | SEC-02, 03, 05, 06, 07 (5 of 8) |
| Trust the token's claims: `getClaims()` instead of `getUser()` | **SEC-03 and SEC-05 only** |

The second row matters most. `getClaims()` checks the signature, so it *looks* safe. But it trusts the
role written inside the token and doesn't notice revoked sessions. Only SEC-03 and SEC-05 catch that.

**Facts learned:**
- Local Supabase signs user tokens with **ES256** (`kid` header) but still accepts tokens signed with the
  legacy **HS256** secret.
- The JWT secret used in the tests is the public demo value of the *local* stack, stored in `.env.test`
  as `TEST_SUPABASE_JWT_SECRET`. It's never a production secret.

Run them with `npm run test:integration -- auth-jwt` (needs `npm run db:test:start`).

---

## 3. API error responses ✅ (500 not reproducible)

CarePulse has **no REST API of its own**. It uses Next.js Server Actions, which return error objects
rather than HTTP status codes. So the status codes live in two places, and both are now tested:

### a) The backend API the app depends on: Supabase PostgREST (`/rest/v1`), integration tests

| ID | Request | Status | Postgres / PostgREST code |
| --- | --- | --- | --- |
| API-01 | `?id=eq.not-a-uuid` | **400** | `22P02` invalid input syntax |
| API-02 | Appointment missing required columns | **400** | `23502` not-null violation |
| API-03 | Insert with the public **anon** key | **401** | `42501` row-level security |
| API-04 | Insert as a signed-in **non-admin** | **403** | `42501` (known identity but not allowed, vs. 401 for an unknown one) |
| API-05 | Anon key reads users/patients/appointments | **200 + `[]`** | RLS hides rows, so no patient data leaks |
| API-06 | Unknown table | **404** | `PGRST205` |
| API-07 | Duplicate email | **409** | `23505` unique violation |
| API-08 | The app's reaction to that 409 | – | `createUser` reuses the existing user (the patient sees no error) |
| API-09 | **No API key at all** | **200 `[]`** locally | Finding: hosted Supabase answers 401, the local stack doesn't. Don't rely on "no key = 401" locally |

### b) The Next.js app itself, E2E with Playwright's `request` fixture (plain HTTP, no browser)

| ID | Request | Status |
| --- | --- | --- |
| API-10 | `GET /` | **200** |
| API-11 | `GET /this-page-does-not-exist` | **404** |
| API-12 | `GET /patients/<unknown id>/register` | not-found page, **200 + `noindex`** (see the bug below) |
| API-13 | `GET /admin` signed out | **307** → `/?admin=true` |
| API-14 | `POST /` with an unknown `Next-Action` id | **404** "Server action not found" |
| API-15 | `PUT /` | **405** |

**Bug found and fixed (API-12):** for an unknown or malformed user id, the register page answered 200 and
showed an empty form that could never be submitted. It now calls `notFound()`. The status is still
**200**: the root `app/loading.tsx` makes Next stream the response, so the 200 header is already sent
when `notFound()` runs. Next streams the 404 page and adds `<meta name="robots" content="noindex">`.
That's documented Next.js behaviour, and the test asserts it. Getting a real 404 status would mean
removing the root `loading.tsx` or checking the id in middleware. That's a design choice, not done here.

**500:** no request reliably triggers a 500. Every server action catches its errors and returns
`{ error }`, which is intended. Database-down failures are already covered at the form level (VAL-16).

---

## 4. Parallel Playwright runs and retries ✅

This was already set up before today (`playwright.config.ts`):

```ts
fullyParallel: true,                     // tests inside a file run in parallel too
workers: process.env.CI ? 2 : undefined, // all CPU cores locally
retries: process.env.CI ? 2 : 0,         // retry only in CI
trace: "on-first-retry",                 // record a trace when a test is retried
forbidOnly: !!process.env.CI,            // a stray test.only fails CI
```

Running in parallel has exposed real problems before. For example, a global `signOut()` revoked other
tests' sessions, which led to a separate sign-out admin. Stress runs (`--repeat-each 200 --workers 8`)
found the "page never moves on" app bug (`test_learnings.md` #17). Today's exercise 6 shows what
retries do to a flaky test.

---

## 5. AI-generated test cases, reviewed manually ⚠️ (your part)

**Generated:** the test plan (`testing_details.md` §3, now 70+ scenarios: BK, VAL, UI, SEC, API, VIS, FLK)
and the tests were written with an AI assistant (Claude Code).

**Not done:** the *manual* review. That has to be you, because an AI reviewing its own output isn't a
manual review. Checklist for doing it properly (about 1 hour):

1. **Pick 10 scenarios** across the groups, e.g. BK-02, BK-10, BK-13, VAL-01, VAL-11, UI-03, UI-15,
   SEC-03, API-04, VIS-01.
2. For each one, ask:
   - **Is the expected result actually right?** Check it against the app's behaviour or the requirement,
     not against the test.
   - **Does the test check what the title says?** Read the assertions and look for weak ones
     (e.g. `toBeTruthy()` where a value should be compared).
   - **Would it fail if the feature broke?** Break the code on purpose (a mutation check) and run it.
   - **Is it the right layer?** Unit vs. component vs. integration vs. E2E.
   - **Is anything important missing?** Edge cases, other roles, error paths.
3. **Write down what you changed and why.** A row per scenario: *kept / rewrote / deleted / added*.
   That record is the evidence of the review.

Things worth questioning during that review (hints, not answers):
- BK-08 counts appointments, and the admin list loads at most 1,000 rows. Is that a test problem or an
  app bug? (`test_learnings.md` §9)
- API-12 accepts status 200 for a not-found page. Is that acceptable for this app?
- Visual baselines exist only for Windows. Is that enough?

---

## 6. Investigate a deliberately introduced flaky test ✅

**The flaky test** (`tests/e2e/flaky-demo.spec.ts`, FLK-01) fills the home form, clicks "Get Started",
**sleeps a fixed 300ms**, then checks the URL **once**:

```ts
await page.waitForTimeout(300);                       // BAD: guesses how long the server needs
expect(page.url()).toMatch(/\/patients\/.+\/register$/); // BAD: checked once, never retried
```

It's skipped unless `FLAKY_DEMO=1`, so it never breaks the normal suite.

### Step 1: reproduce and measure (`--repeat-each`)

```bash
FLAKY_DEMO=1 FLAKY_DELAY_MS=300 npx playwright test flaky-demo --grep FLK-01 --repeat-each 50 --workers 8
```

| Sleep | Workers | Failures |
| --- | --- | --- |
| 100ms | 8 | 42 / 50 |
| 200ms | 8 | 23 / 50 |
| 300ms | 8 | 14 / 50 |
| 400ms | 8 | 0 / 40 |
| 300ms | **1** | **0 / 30** |

**It depends on load.** With one worker it never fails, so it would look fine on a developer's laptop and
then fail in CI or under parallel load. A single normal run proves nothing.

### Step 2: see what retries do

```bash
FLAKY_DEMO=1 npx playwright test flaky-demo --grep FLK-01 --repeat-each 30 --workers 8 --retries 2
# -> 3 flaky, 27 passed (of 30), exit code 0
```

Playwright labels a test that failed and then passed on retry as **"flaky"**. The run is green.
Retries **hide** flakiness; they don't fix it. Always look at the "flaky" count in the report.

### Step 3: read the trace of a failing run

```bash
FLAKY_DEMO=1 npx playwright test flaky-demo --grep FLK-01 --repeat-each 30 --workers 8 --trace retain-on-failure
npx playwright show-report   # failed test -> Traces
```

Error: `Expected pattern /register$/ — Received "http://localhost:3100/"`. The page hadn't moved.
Timeline from the trace (relative to the click):

| Time | Event (trace tab) |
| --- | --- |
| 0–69 ms | `click` "Get Started" (Actions) |
| 62 ms | `POST /` (the Server Action that creates the user and redirects) starts (Network) |
| 74–381 ms | `waitForTimeout(300)` (Actions) |
| 381 ms | URL checked once: still `/` → **fail** (Errors) |
| test end | `POST /` **still has no response** (Network, status -1) |

**Root cause:** the test guessed the server needs under 300ms. Under 8 parallel workers, creating the user
in the database and redirecting took longer. The test has a timing assumption; the app isn't broken.

### Step 4: fix it and prove the fix with the same stress test

FLK-02 is the same journey with a **web-first assertion**, which retries until the condition is true
(up to the 10s `expect` timeout):

```ts
await expect(page).toHaveURL(/\/patients\/.+\/register$/);
```

Result: **100 / 100 passed** with 8 workers. FLK-02 is part of the normal suite.

**Rules learned:** never use `waitForTimeout` as a wait. Never read UI state once with a plain
`expect(value)`; use `await expect(locator/page).toX()`. Measure flakiness with `--repeat-each` under load,
and treat "flaky" in the report as a failure to investigate.

---

## 7. Visual baseline vs. a modified UI ✅

**Tests** (`tests/e2e/visual.spec.ts`, tagged `@visual`):
- **VIS-01:** full home page at 1440×900.
- **VIS-02:** the admin sign-in modal (an element screenshot).

Both use `animations: "disabled"`, `caret: "hide"`, wait for `document.fonts.ready`, and allow
`maxDiffPixelRatio: 0.01` (1% anti-aliasing noise).

**Baselines:** `tests/e2e/visual.spec.ts-snapshots/home-chromium-win32.png` and `admin-modal-chromium-win32.png`.
The first run creates them, and that run fails by design ("snapshot doesn't exist, writing actual").
After that, **10 / 10** repeat runs passed, so the baselines are stable.

### The experiment: modify the UI and compare
Two deliberate changes, built and tested, then reverted:
1. **Obvious:** the primary button colour `bg-green-700` → `bg-green-600` (`app/globals.css`).
2. **Subtle:** footer margin `mt-20` → `mt-16` on the home page (16px).

| Test | Result | Diff |
| --- | --- | --- |
| VIS-01 home | ❌ **28,390 px differ (3%)** | `docs/testing/vis-01-home-diff.png` |
| VIS-02 modal | ❌ **19,965 px differ (11%)** | `docs/testing/vis-02-admin-modal-diff.png` |

What the diff image shows (red = changed pixels):
- The **button** is solid red: the colour change, even though green-700 → green-600 is hard to see by eye.
- **All the form text** has red "double" outlines. Reducing the footer margin by 16px moved the whole
  **vertically centred** form up by about 8px. A small layout change in one place changes pixels everywhere,
  which is exactly what a human reviewer would miss.
- The modal's Sign In button uses the same `shad-primary-btn` class, so VIS-02 caught the shared-style change too.

After reverting both changes and rebuilding, both tests pass again.

### Workflow
```bash
npx playwright test visual                     # compare
npx playwright show-report                     # failed test -> Expected / Actual / Diff / slider
npx playwright test visual --update-snapshots  # ONLY after an intended design change, then commit the PNGs
```

### Why CI skips them
Fonts are rendered differently on Windows and Linux. Baselines are per OS (`-win32.png` vs `-linux.png`),
and only Windows baselines are committed. So `playwright.config.ts` has
`grepInvert: process.env.CI ? /@visual/ : undefined`, and CI lists 0 VIS tests while local runs list 2.
To run them in CI as well, generate Linux baselines inside Playwright's Docker image
(`mcr.microsoft.com/playwright`) and commit them too. UI-11 (`theme.spec.ts`) remains the cross-platform
colour and contrast check.

---

## Files changed today

| File | Change |
| --- | --- |
| `tests/integration/auth-jwt.int.test.ts` | **new**: SEC-01…08 |
| `tests/integration/api-errors.int.test.ts` | **new**: API-01…09 |
| `tests/e2e/http-status.spec.ts` | **new**: API-10…15, SEC-09 |
| `tests/e2e/flaky-demo.spec.ts` | **new**: FLK-01 (skipped by default), FLK-02 |
| `tests/e2e/visual.spec.ts` + `visual.spec.ts-snapshots/` | **new**: VIS-01, VIS-02 + Windows baselines |
| `docs/testing/*.png` | diff images from the visual experiment |
| `app/patients/[userId]/register/page.tsx` | **fix**: `notFound()` for an unknown user |
| `playwright.config.ts` | skip `@visual` in CI |
| `.env.test` | `TEST_SUPABASE_JWT_SECRET` (local demo value) |
| `testing_details.md` (local, git-ignored) | new scenario tables §3.4–3.6 |
