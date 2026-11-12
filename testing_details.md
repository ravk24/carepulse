# CarePulse – Testing Plan

_Prepared: 2026-11-12 · Status: **planned, not yet implemented**_

This document describes the testing strategy for CarePulse: the tools, which layer tests what, the test scenarios for appointment booking, form validation and user interaction, test data, CI, and how third-party tools (Momentic, mabl, Applitools) could fit in.

**Stack under test:** Next.js 15 (App Router, Server Components, Server Actions) · React 19 · Supabase (Postgres, Auth, Storage) · Zod 4 + React Hook Form · Twilio SMS · Vercel.

---

## 1. Strategy at a glance

| Layer | Tool | Runs against | Speed | Share of tests |
| --- | --- | --- | --- | --- |
| Unit | **Vitest** | Pure functions and Zod schemas | ms | ~50% |
| Component | **Vitest + React Testing Library + user-event** (jsdom) | Client components, with server actions mocked | ms–s | ~25% |
| Server integration | **Vitest + local Supabase** (Supabase CLI in Docker) + **MSW** for Twilio | Server actions against a real Postgres | s | ~15% |
| End-to-end | **Playwright** | Production build (`next build && next start`) or a Vercel preview | s–min | ~10% (critical flows) |
| Visual regression (optional) | Playwright `toHaveScreenshot`, or **Applitools Eyes** | Key pages | s | a handful |
| CI | **GitHub Actions** | Every push / pull request | – | – |

**Why these tools**
- **Vitest instead of Jest:** it runs TypeScript and ESM without extra setup and is much faster. The assertion style is the same as Jest's.
- **React Testing Library:** tests what the user sees (labels, roles, error text) rather than implementation details.
- **Playwright instead of Cypress or Puppeteer:**
  - waits for elements automatically, so tests are less flaky;
  - runs Chromium, Firefox and WebKit;
  - saves sign-in state, so the admin logs in once per run;
  - records a trace viewer for failed tests and can generate tests by recording clicks (`npx playwright codegen`).
- **Local Supabase:** tests run against real Postgres, Row Level Security, triggers and storage, not mocks. The database is reset for every run.
- **Async Server Components** (success page, admin dashboard, register and booking pages): these can't be tested reliably with React Testing Library. Following Next.js's own guidance, they're covered by E2E tests.

---

## 2. Tools to install

```bash
# Unit + component
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom \
  @vitest/coverage-v8

# Server integration
npm i -D msw
# Supabase CLI (needs Docker Desktop)
npm i -D supabase

# E2E
npm i -D @playwright/test
npx playwright install --with-deps chromium firefox webkit
```

### Planned scripts (`package.json`)

| Script | Command | Purpose |
| --- | --- | --- |
| `test` | `vitest run` | Unit and component tests |
| `test:watch` | `vitest` | Watch mode while developing |
| `test:coverage` | `vitest run --coverage` | Coverage report (v8) |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | Server actions against local Supabase |
| `test:e2e` | `playwright test` | E2E against a production build |
| `test:e2e:ui` | `playwright test --ui` | Interactive E2E debugging |
| `db:test:start` / `db:test:reset` | `supabase start` / `supabase db reset` | Start or reset the local test database |

### Planned folder structure

```
tests/
  unit/                    # *.test.ts – validation, utils, constants
  component/               # *.test.tsx – forms, modal, avatar, logo
  integration/             # *.int.test.ts – server actions + local Supabase
  e2e/                     # *.spec.ts – Playwright
    fixtures/              # test users, sample ID document (fake image)
    auth.setup.ts          # signs the admin in once and saves storageState
  mocks/
    handlers.ts            # MSW handlers (Twilio API)
vitest.config.ts           # jsdom, setupFiles, path aliases (@/*)
vitest.integration.config.ts
playwright.config.ts       # webServer: next build && next start, projects per browser
supabase/seed.sql          # deterministic seed data for tests
.env.test                  # local Supabase URL/keys only – NO production secrets
```

---

## 3. Test scenarios

Each scenario ID (e.g. `BK-01`) is meant to appear in the test's title, so results trace back to this list.
**Layer key:** U = unit, C = component, I = server integration, E = E2E, V = visual.

### 3.1 Appointment booking (BK)

| ID | Scenario | Expected result | Layer |
| --- | --- | --- | --- |
| BK-01 | New patient: Get Started → Register → Book → Success | Success page shows the chosen doctor and the date/time; the appointment is saved as `pending` | E |
| BK-02 | An existing user re-enters the same email on the home page | The existing user is reused (no duplicate) and goes to the right step | I, E |
| BK-03 | An already-registered patient opens `/register` | Redirected to `/new-appointment` | E |
| BK-04 | An unregistered user opens `/new-appointment` | Redirected to `/register` | E |
| BK-05 | `createAppointment` with a valid patient | Returns `{ appointment }`, linked to the right patient and user | I |
| BK-06 | Create form with no `patientId` | Shows an error; never calls the admin-only `updateAppointment` | C, I |
| BK-07 | Success page with an invalid or deleted `appointmentId` | "Appointment not found" state, no crash | E |
| BK-08 | Admin schedules a pending appointment | Status becomes `scheduled`; the dashboard counts update; the SMS function is called | I, E |
| BK-09 | Admin cancels with a reason | Status becomes `cancelled`; `cancellationReason` is saved; the SMS function is called | I, E |
| BK-10 | `updateAppointment` / `getRecentAppointmentList` called by a non-admin | Rejected (the `assertAdmin` check fails); no data returned or changed | I |
| BK-11 | Twilio environment variables missing | Appointment still created or updated; SMS skipped without error | I |
| BK-12 | Twilio API returns an error (e.g. 21266) | The update still succeeds; the error is logged, not shown to the patient | I (MSW) |
| BK-13 | Register with an identity-document upload | File saved in the **private** bucket; only its path stored; a signed URL works and expires | I |
| BK-14 | Deleting a user | Patients and appointments are removed with it (cascade) | I |
| BK-15 | Doctor list | The booking dropdown lists all 12 doctors with initials avatars | C, E |

### 3.2 Form validation (VAL)

| ID | Field / rule | Cases | Layer |
| --- | --- | --- | --- |
| VAL-01 | Name: 2–50 characters | 1 character ✗, 2 ✓, 50 ✓, 51 ✗ | U, C |
| VAL-02 | Email format | `a@b.co` ✓, `abc` ✗, empty ✗ | U, C |
| VAL-03 | Phone: E.164 (`+` and 10–15 digits) | `+15551234567` ✓, `5551234567` ✗, `+123` ✗ | U, C |
| VAL-04 | Birth date required | `null` ✗ → "Select your date of birth" | U |
| VAL-05 | Gender: male / female / other | other values ✗ | U |
| VAL-06 | Address: 5–500 characters | boundaries | U |
| VAL-07 | Occupation, emergency contact name, insurance provider, policy number: length limits | boundaries | U |
| VAL-08 | Emergency contact number: E.164 | same as VAL-03 | U |
| VAL-09 | Primary physician required | empty ✗ → "Select at least one doctor" | U, C |
| VAL-10 | All three consents must be ticked | any unticked ✗ with its own message | U, C, E |
| VAL-11 | Booking reason: 2–500 characters (create only) | empty ✗ on create; optional on schedule and cancel | U |
| VAL-12 | Cancellation reason: 2–500 characters (cancel only) | required on cancel; optional elsewhere | U |
| VAL-13 | Appointment date required | `null` ✗ → "Select a date and time" | U |
| VAL-14 | `getAppointmentSchema(type)` | Returns the right schema for create, schedule and cancel | U |
| VAL-15 | Error messages appear under the right field and clear once fixed | Shown in a `.shad-error` element | C |
| VAL-16 | Server-side errors (e.g. database down) | Shown in the form's `role="alert"` area; the button is enabled again | C, E |

### 3.3 User interaction & access (UI)

| ID | Scenario | Expected result | Layer |
| --- | --- | --- | --- |
| UI-01 | Signed-out visit to `/admin` | Redirected to `/?admin=true`; the login modal opens | E |
| UI-02 | Admin logs in with valid credentials | Lands on `/admin`; the header shows the email | E |
| UI-03 | Wrong password, or a valid non-admin user | Generic "Invalid email or password"; a non-admin's session is signed out | I, E |
| UI-04 | Admin signs out | Returns to `/`; `/admin` is blocked again | E |
| UI-05 | Signed-in admin opens `/?admin=true` | Redirected to `/admin` | E |
| UI-06 | Logo clicked on every page | Goes to `/` | E |
| UI-07 | Submit button while a request is running | Shows a loading state and is disabled, so it can't be submitted twice | C |
| UI-08 | Schedule / Cancel modal | Opens with the right title, pre-fills the doctor and date, closes on success | C, E |
| UI-09 | Admin table paging | Next / previous work once there are more than 10 rows | C, E |
| UI-10 | File uploader | Selecting a file shows a preview; the value reaches the form | C |
| UI-11 | Dark theme and readable text on every page | White or grey text on a dark background (guards against the earlier black-text bug) | V |
| UI-12 | Footer | "© 2025 CarePulse" on every page; no "CarePluse" typo | E |
| UI-13 | Mobile viewport (390×844) | Forms usable, no horizontal scroll, side image hidden | E, V |
| UI-14 | Accessibility | Every form control has a label; axe scan finds no serious issues (`@axe-core/playwright`) | E |
| UI-15 | Keyboard-only booking | The full booking flow works with Tab, Enter and the arrow keys | E |

---

## 4. Test data & environments

- **Never run automated tests against the production Supabase project.** They create users and appointments, and could send SMS.
- **Local:**
  - `supabase start` runs Postgres, Auth and Storage in Docker. `supabase db reset` applies `supabase/schema.sql` and `supabase/seed.sql`.
  - `.env.test` points at the local URL and keys that `supabase start` prints. These are not secret, but keep them out of production anyway.
  - **Admin test user:** created in the seed (or in a global setup step) with `app_metadata.role = 'admin'`.
- **Twilio:** keep `TWILIO_*` unset in tests, or mock its API with MSW, so no real SMS is ever sent.
- **Test emails:** use `@example.com` with a unique suffix per run (e.g. `e2e-<timestamp>@example.com`) so tests can run in parallel.
- **ID document fixture:** a small fake PNG in `tests/e2e/fixtures/`. Never a real ID.
- **Hosted E2E (optional):** a separate Supabase "test" project wired to Vercel **Preview** deployments only, so Playwright or a SaaS tool can test preview URLs.

---

## 5. CI (GitHub Actions) – planned

`.github/workflows/test.yml`, running on every push and pull request to `main`:

1. **lint-and-unit:** `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run test:coverage`. Upload the coverage report.
2. **integration** (needs Docker, which GitHub runners have): `npx supabase start` → `npm run test:integration`.
3. **e2e:** `npx supabase start` → `npx playwright install --with-deps` → `npm run test:e2e` (Playwright starts the production build). Upload the Playwright HTML report and traces when a test fails.

Optional: run a smoke subset (`@smoke` tag: BK-01, UI-01, UI-02) against the Vercel preview URL after each deploy.

**Coverage targets to start with:** `lib/validation.ts` 100%, `lib/utils.ts` 90%+, `lib/actions/*` 80%+ (through integration tests).

---

## 6. Momentic, mabl and Applitools: are they useful here?

**Short answer:** none of them is needed, and none of them replaces Vitest or Playwright. They only test through the browser, so they can't cover Zod schemas, server actions, the admin check or the database. Two of them can still add value as a later layer:

| Tool | What it is | Fit for CarePulse | Recommendation |
| --- | --- | --- | --- |
| **Applitools Eyes** | Visual AI: compares screenshots and ignores pixel noise. Plugs into Playwright (`@applitools/eyes-playwright`) | **Good fit.** This app has already had a purely visual bug (black text on the dark theme), which normal tests wouldn't catch. Also useful for the dark UI, layout across browsers and devices, and the dashboard | **Optional, worth adding after Playwright is in place.** Start with Playwright's free `toHaveScreenshot()`; move to Applitools if screenshots get flaky across browsers or you want its dashboard |
| **Momentic** | AI-native E2E: steps written in plain English, with locators that repair themselves | **Possible.** Flows like "book an appointment with Dr. Devi Prasad Shetty" are easy to describe in English, and it can run against Vercel preview URLs | **Optional and experimental.** Good for quick coverage or for trying AI-driven testing. Keep Playwright as the main suite: free, in the repo, reviewable, runs in CI |
| **mabl** | Low-code SaaS test platform (recorder, auto-healing, API, accessibility and performance checks) | **Low value here.** It's built for QA teams without coders and larger apps; for a small codebase owned by developers it duplicates Playwright and adds cost | **Skip**, unless your team or employer already uses it or you want it on your CV |

**Caveats for any SaaS testing tool**
- **Test environment:** they need a publicly reachable URL. Point them at a **preview or test deployment with a test Supabase project**, never production. Otherwise they create real records and may send SMS.
- **Data:** use only fake patient data. These tools store screenshots and DOM snapshots on their servers.
- **Cost:** pricing and free-tier limits change; check current plans before committing.

**Suggested order:** Vitest unit tests → component tests → Playwright E2E → integration with local Supabase → CI. Then optionally Applitools for visual checks, then optionally a Momentic trial.

---

## 7. Implementation checklist (for tomorrow)

- [ ] Install Vitest, React Testing Library and jsdom; add `vitest.config.ts` (with `@/*` path alias and jest-dom setup)
- [ ] Unit tests: `lib/validation.ts` (VAL-01 … VAL-14), `lib/utils.ts`, `DoctorAvatar` initials
- [ ] Component tests: PatientForm, RegisterForm (consents, errors), AppointmentForm (create / schedule / cancel, BK-06, UI-07), AdminLoginModal
- [ ] Install Playwright; add `playwright.config.ts` (webServer = production build, chromium + mobile project), `auth.setup.ts` for admin
- [ ] E2E: BK-01, BK-03, BK-04, BK-07, BK-08, BK-09, UI-01 … UI-06, UI-12, UI-13, UI-14
- [ ] Supabase CLI: `supabase init`, test seed with an admin user, `.env.test`
- [ ] Integration tests: BK-02, BK-05, BK-10 … BK-14, UI-03 (MSW for Twilio)
- [ ] npm scripts and the GitHub Actions workflow
- [ ] (Optional) visual snapshots with `toHaveScreenshot` for UI-11 / UI-13 → evaluate Applitools
- [ ] (Optional) write the scenarios as an OpenSpec change (`/openspec-propose "add automated test suite"`) so specs and tests stay in sync
