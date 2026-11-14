# CarePulse – Testing Q&A

Answers are based on this repo's actual setup (updated 2026-11-14 with the SEC, API, VIS and FLK tests): `playwright.config.ts`, `vitest.config.mts`,
`tests/`, `supabase/`, `.env.test`, `.github/workflows/test.yml` and `testing_details.md`.

---

## 1. Why do we use Supabase locally with Docker while testing?

`npm run db:test:start` runs `supabase start`, which starts a **real Postgres + Auth + Storage**
stack in Docker containers on your machine (`http://127.0.0.1:54321`). We do this for these reasons:

1. **Production stays safe.** Integration and E2E tests create users, patients and appointments,
   upload ID documents and change appointment statuses. Doing that against the production project
   would pollute real data and could send real SMS. The repo enforces this:
   - `playwright.config.ts` throws `"E2E tests must run against a local Supabase"` if
     `NEXT_PUBLIC_SUPABASE_URL` isn't `127.0.0.1`/`localhost`.
   - `tests/support/admin.ts` refuses to create test users on a non-local URL.
   - `.env.test` only contains the public demo keys that `supabase start` prints, and leaves Twilio unset.
2. **It's a real database, not a mock.** Mocks can't prove the things that break silently: RLS and
   admin checks (`assertAdmin`, BK-10), cascade deletes (BK-14), the private storage bucket and signed
   URL expiry (BK-13), and duplicate-email reuse (BK-02). Only a real Supabase shows how these behave.
3. **Same schema every time.** `supabase/config.toml`, `supabase/schema.sql` and `supabase/seed.sql`
   describe the database as code. `npm run db:test:reset` wipes it and rebuilds it from those files,
   so every developer and every CI run starts from an identical, known state.
4. **Free, fast and offline.** There's no network latency, no hosted-project quotas and no shared
   test project that two people (or two CI runs) could break for each other.
5. **CI can do the same thing.** GitHub Actions runners have Docker, so `.github/workflows/test.yml`
   runs the same `npm run db:test:start` before the integration and E2E steps.
6. **Only what's needed runs.** The script excludes Studio, imgproxy, Mailpit, edge-runtime, logflare,
   vector, realtime, supavisor and postgres-meta (`-x ...`), so only Postgres, Auth (GoTrue), Storage
   and the API gateway start. That makes startup quicker and uses less memory.

> Unit and component tests **don't** need Docker. The `unit` project uses dummy env values and makes
> no network calls. Only `npm run test:integration`, `npm run test:coverage` and `npm run test:e2e` need it.

---

## 2. What are BK-01, VAL-xx, UI-xx… and what do the numbers mean?

They are **scenario IDs** from the test plan in `testing_details.md` §3. Each one is a single
requirement ("scenario → expected result"). The ID goes in the test title, for example:

```ts
test("BK-01 @smoke new patient: Get Started -> Register -> Book -> Success", ...)
```

so a passing or failing test in any report points straight back to the requirement it checks.

| Prefix | Area | Range | Examples |
| --- | --- | --- | --- |
| **BK** | Appointment **B**oo**K**ing flow (core business) | BK-01 … BK-15 | BK-01 full new-patient booking, BK-08 admin schedules, BK-10 non-admin rejected, BK-12 Twilio error doesn't block updates, BK-13 private bucket + signed URLs |
| **VAL** | Form **VAL**idation rules (Zod schemas, form errors) | VAL-01 … VAL-16 | VAL-01 name length 2–50 |
| **UI** | **U**ser **I**nteraction & access (routing, auth, a11y, theme, responsive) | UI-01 … UI-15 | UI-01 `/admin` redirects to the login modal, UI-11 dark theme readable, UI-15 keyboard-only booking |
| **SEC** | Session-token **SEC**urity (JWT attacks on the admin check) | SEC-01 … SEC-09 | SEC-03 correctly signed token claiming admin is rejected, SEC-05 revoked session replayed |
| **API** | HTTP error responses (Supabase REST + the app) | API-01 … API-15 | API-04 non-admin write → 403, API-07 duplicate email → 409, API-13 `/admin` → 307 |
| **VIS** | **VIS**ual regression (screenshot baselines) | VIS-01 … VIS-02 | VIS-01 home page, VIS-02 admin modal |
| **FLK** | **FL**a**K**y-test teaching demo | FLK-01 … FLK-02 | FLK-01 deliberately flaky (opt-in), FLK-02 its fix |

**What the numbers mean:** the number is just a running index inside its group (`01`, `02`, …),
zero-padded so the IDs sort correctly. It **does not** show priority or order of execution.
New scenarios get the next free number, and an ID is never reused for a different meaning.

The plan's **Layer** column says which kind of test covers each scenario:
`U` unit, `C` component, `I` integration, `E` E2E, `V` visual. Some IDs (e.g. BK-02, BK-08) are covered
in more than one layer, so the same ID can appear in both `tests/integration` and `tests/e2e`.

**Tags:** `@smoke` (on BK-01, UI-01, UI-02) marks a small, fast subset of tests. You can run just
those with `npx playwright test --grep @smoke`, for example against a preview deploy.
You can also run one scenario by its ID: `npx playwright test --grep BK-07`.

---

## 3. What is the `tests/support` directory for?

It holds **shared test infrastructure**: setup files, mocks and helpers. It has **no test files of
its own** (nothing in it matches `*.test.ts` or `*.spec.ts`). The test files import from it, and
`vitest.config.mts` / Playwright's global setup point to it.

| File | Used by | Why it exists |
| --- | --- | --- |
| `setup-dom.ts` | `component` project (`setupFiles`) | Adds `jest-dom` matchers (`toBeInTheDocument`…), runs `cleanup()` after each test, and polyfills browser APIs jsdom lacks but Radix UI needs (`ResizeObserver`, pointer capture, `scrollIntoView`). |
| `setup-integration.ts` | `integration` project (`setupFiles`) | Loads `.env.test` **before** the app's Supabase client is created. Mocks Next.js-only APIs that don't exist without a Next server (`next/headers` cookies, `next/cache` `revalidatePath`, `next/navigation` `redirect`). Starts and stops the MSW server. |
| `global-setup-integration.ts` | `integration` project (`globalSetup`, runs once) | Checks that local Supabase is up, failing with one clear message ("start it with `npm run db:test:start`") instead of 50 "fetch failed" errors. Then creates the test users. |
| `admin.ts` | Integration global setup **and** `tests/e2e/global-setup.ts` | `ensureTestUsers()` creates or reuses the test admin, a second admin for the sign-out test, and a normal non-admin user through the Supabase Auth admin API. Refuses to run on a non-local URL. |
| `cookies.ts` | `setup-integration.ts`, integration tests | An in-memory cookie jar standing in for the browser, so `signInAdmin()` writes the session cookie and `assertAdmin()` reads it back like two real requests. |
| `factories.ts` | Integration tests | Helpers like `uniqueEmail()`, `makeUser()`, `makePatient()`. They create test data with **unique emails** so tests never collide and can run repeatedly. |
| `msw.ts` | Integration tests | Mock Service Worker handlers that intercept Twilio's HTTP API. `twilioOk` records every SMS in `sentSms` for assertions. `twilioError21266` reproduces the real error for BK-12. No real SMS is ever sent. |
| `empty.ts` | `vitest.config.mts` alias | `export {}`. The `server-only` package throws when imported outside an RSC bundle, so tests alias it to this empty module to import server code directly. |

Keeping this code here means each test file stays short and only contains the scenario itself.

---

## 4. The `coverage` and `playwright-report` folders

Both folders are **generated output**. They're gitignored, safe to delete, and recreated on the next run.

### `coverage/` (from Vitest, `npm run test:coverage`)

Vitest's V8 coverage provider records which lines, branches and functions in
`lib/**`, `components/**` (except `components/ui/**`) and `constants/**` actually ran during the
unit, component and integration tests. Configured reporters: `text`, `html`, `json-summary`.

| Item | Meaning |
| --- | --- |
| `index.html` | **Open this in a browser.** It's a table of every folder and file with % Statements / Branches / Functions / Lines. Click through to a file to see its source with **green** (covered) and **red** (never ran) lines, plus `I`/`E` markers for untaken if/else branches and `1x`, `5x` hit counts. |
| `lib/`, `components/`, `constants/` | One HTML page per source file (the drill-down pages of the report). |
| `coverage-summary.json` | Machine-readable totals (the `json-summary` reporter), handy for CI badges or scripts. |
| `base.css`, `prettify.*`, `sorter.js`, `block-navigation.js`, `theme.js`, fonts, `sort-arrow-sprite.png`, `favicon.png` | Assets for the HTML report (styling, syntax highlighting, sortable columns, keyboard jumps between uncovered blocks with `n`/`j`/`p`/`k`). |

**Thresholds:** the run **fails** if coverage drops below 90% lines/statements/functions or 80% branches,
or below 100% on anything in `lib/validation.ts` (the core business rules). In CI, the folder is uploaded
as the `coverage` artifact.

> Coverage shows which code **ran**, not whether the tests **checked** it. A line can be green
> without any assertion about its result. That's why `test_learnings.md` also mentions
> "mutation checks" (break the code on purpose and confirm a test fails).

### `playwright-report/` (from Playwright, `npm run test:e2e`)

The `html` reporter (configured with `open: "never"`) writes a **self-contained single-page report**:

- `index.html` contains the whole report. Open it with `npx playwright show-report`. Opening
  the file directly with `file://` can block trace loading, so use the command.
- When there are failures, a `data/` folder is added next to it with **screenshots**
  (`screenshot: "only-on-failure"`), **traces** (`trace.zip`) and other attachments, and it opens
  automatically.
- In the report you can filter by passed, failed, flaky or skipped tests, by project (`setup`, `chromium`, `mobile`)
  and by text or tag (e.g. `BK-`, `@smoke`). Each test shows its steps, timings, error message
  and attachments.

Related folder: **`test-results/`** is Playwright's *raw* per-test output directory (traces,
screenshots and videos while the run is going on). It also contains `.last-run.json`, which `npx playwright test --last-failed`
uses to re-run only the failures. In CI the report is uploaded as the `playwright-report` artifact.

---

## 5. The `.next-e2e` folder: subfolders, files, and why each exists

### Why the folder exists at all

`playwright.config.ts` starts the app with `next build && next start -p 3100` and sets
`NEXT_DIST_DIR=".next-e2e"`. `next.config.mjs` uses it: `distDir: process.env.NEXT_DIST_DIR || ".next"`.

So `.next-e2e` is a **complete Next.js production build**, exactly like `.next`, but:
- it was built with the **local Supabase URL/keys baked in**. `NEXT_PUBLIC_*` values are inlined into
  the JS at build time, so this build talks to `127.0.0.1:54321`.
- it's kept **separate** so a later plain `npm start` can never accidentally serve the test build
  (pointing at the local DB), and so running E2E tests doesn't overwrite your normal `.next` build.
- E2E tests check the **production build** (what users get), not `next dev`.

It's gitignored and fully regenerable. Delete it any time.

### Top-level files

| File | Why it exists |
| --- | --- |
| `BUILD_ID` | A random ID for this build (e.g. `WTerMBfvWgxIeJZQO5MEM`). It's used in static asset paths and for cache-busting, so browsers never mix files from two different builds. |
| `package.json` | Just `{"type": "commonjs"}`, so Node treats the compiled `.js` files in this folder as CommonJS whatever the root `package.json` says. |
| `build-manifest.json` | Pages Router: which JS chunks (and polyfills) each page needs. It still exists for the built-in `_app`/`_error` pages. |
| `app-build-manifest.json` | App Router: which client JS chunks each app route needs (`/`, `/admin`, `/patients/[userId]/...`). |
| `app-path-routes-manifest.json` | Maps internal app paths (`/admin/page`) to public URLs (`/admin`). |
| `routes-manifest.json` | All routing rules: static routes, dynamic routes with their regexes (`[userId]`), redirects, rewrites, headers. `next start` uses it to route requests. |
| `prerender-manifest.json` | Which routes were statically pre-rendered at build time, their revalidate settings, and the preview-mode keys. |
| `images-manifest.json` | The `next/image` config (formats AVIF/WebP, sizes, `minimumCacheTTL`) used by the image optimizer at runtime. |
| `react-loadable-manifest.json` | Maps `next/dynamic` imports to their chunk files. The forms lazy-load react-datepicker and Radix Select this way. |
| `required-server-files.json` | The resolved `next.config` and the list of files a server needs to run this build (used by `next start` / standalone deploys). |
| `next-server.js.nft.json`, `next-minimal-server.js.nft.json` | **N**ode **F**ile **T**race: the exact set of `node_modules` files the server needs. Used when packaging for deploys (e.g. Vercel, standalone). |
| `export-marker.json` | Records whether the build can be statically exported (`next export`); internal bookkeeping. |
| `trace` | Next.js's **build performance trace** (JSON events like `generate-buildid`, `load-custom-routes` with durations). It's for profiling slow builds and has **nothing to do with Playwright traces**. |

### `server/` – code that runs on the Node server

| Item | Why it exists |
| --- | --- |
| `app/` | Compiled App Router routes. For each route there's a `page.js` (the server bundle), a `page.js.nft.json` (file trace) and a `page_client-reference-manifest.js` (which client components the page references, so the RSC payload can point to the right browser chunks). Statically pre-rendered routes also have `index.html` / `index.rsc` / `index.meta` (HTML, the React Server Component payload, and headers/status). The same goes for `_not-found.*`. Dynamic routes like `patients/[userId]` are rendered per request. |
| `pages/` | Pages Router internals (`_app.js`, `_document`, `_error`) that Next still builds for fallback error pages. |
| `chunks/` | Server-side code shared between routes (libraries, `lib/actions/*`…), split so it isn't duplicated in every `page.js`. |
| `middleware.js` (+ `.map`) | Your `middleware.ts` (the admin route protection), compiled. |
| `edge-runtime-webpack.js` (+ `.map`) | The webpack runtime for code compiled for the edge runtime, which middleware uses in Next 15. |
| `webpack-runtime.js` | The webpack module loader for the Node server bundles. |
| `app-paths-manifest.json` | Route → which server bundle file to load. |
| `pages-manifest.json` | Same thing for the Pages Router files. |
| `server-reference-manifest.js/.json` | Maps **Server Action IDs** to their modules. When a form calls `createAppointment`, the browser only sends an ID, and this manifest says which function runs. |
| `middleware-manifest.json`, `middleware-build-manifest.js`, `middleware-react-loadable-manifest.js` | Tell the server which middleware exists, its matcher, and its files and chunks. |
| `functions-config-manifest.json` | Per-route function config (runtime, maxDuration…) for deployment platforms. |
| `next-font-manifest.js/.json` | Which `next/font` files each route uses, so they can be preloaded. |
| `interception-route-rewrite-manifest.js` | Rewrites for intercepting routes (`(.)` folders). It's empty or trivial here but always generated. |
| `route-cache/` | Next's on-disk cache for rendered route output; empty unless routes are cached at runtime. |

### `static/` – files sent to the browser (served as `/_next/static/...`)

| Item | Why it exists |
| --- | --- |
| `chunks/` | Client JavaScript bundles, content-hashed (`255-73938ce8a8eac1ad.js`) so browsers can cache them forever. |
| `css/` | Compiled, minified Tailwind/global CSS, hashed. |
| `media/` | Fonts (`.woff2` from `next/font`) and imported images, hashed. |
| `<BUILD_ID>/` | `_buildManifest.js` and `_ssgManifest.js`. The client router uses them to know which chunks to prefetch for each route. |

### `cache/` – build and runtime caches (makes the *next* build or run faster)

| Item | Why it exists |
| --- | --- |
| `webpack/` (`client-production`, `server-production`, `edge-server-production`) | Webpack's persistent cache, one per compilation target. A rebuild with unchanged files is much faster. This is why the second `npm run test:e2e` builds quicker. |
| `images/` | Images optimized by `next/image` at runtime (resized, AVIF/WebP), one folder per image and size hash. They're kept for `minimumCacheTTL` (1 year). |
| `swc/plugins` | Cache for SWC compiler plugins. |
| `eslint/` | ESLint cache from the build's lint step (empty here). |

### `types/`

TypeScript types generated during the build: `routes.d.ts` (typed routes), `validator.ts` and
`app/**/page.ts`, `layout.ts` (check that each page and layout exports valid props, `params` and so on),
and `cache-life.d.ts` (types for `cacheLife` profiles). They're used by the build's type-check step.

### `diagnostics/`

`build-diagnostics.json` records the last build stage reached (e.g. `"static-generation"`) and the
build options, which helps when a build fails partway through. `framework.json` records the framework and version
(`Next.js 15.5.29`).

---

## 6. How to read traces in Playwright

A **trace** (`trace.zip`) is a recording of one test run: every action, a DOM snapshot before
and after each action, console logs, network requests, the source line, and errors. You can replay it
step by step after the test has finished.

### When this project records traces

`playwright.config.ts` has `trace: "on-first-retry"`, `retries: CI ? 2 : 0`.

- **In CI**, a failing test is retried and the retry is traced. Download the `playwright-report`
  artifact from the GitHub Actions run to get it.
- **Locally there are no retries, so no traces are recorded by default.** To get one, force it:

```bash
npx playwright test --trace on                 # trace every test
npx playwright test --grep BK-01 --trace on    # just one scenario
npx playwright test --retries 1                # behave like CI (trace on first retry)
```

### How to open a trace

```bash
npx playwright show-report                      # HTML report -> click a test -> "Traces" section -> click the trace
npx playwright show-trace test-results/<test-folder>/trace.zip   # open one trace directly
npx playwright show-report ./playwright-report  # a report downloaded from CI (unzip it first)
```

You can also drag a `trace.zip` onto **https://trace.playwright.dev**. It runs fully in your
browser and the file isn't uploaded. Or use `npm run test:e2e:ui` (UI mode), which shows the same
views live while tests run.

### Reading the Trace Viewer, area by area

1. **Timeline / filmstrip (top):** screenshots over time. Hover to see what the page looked like at
   that moment, or drag to zoom into a time range.
2. **Actions list (left):** every Playwright call (`goto`, `click`, `fill`, `expect…`) in order,
   with its duration. The **failing action is red**. Start there. Actions that took a long time
   usually mean auto-waiting (e.g. waiting for an element that never appeared).
3. **Snapshot pane (center):** the **real DOM** at that step, with tabs:
   - **Before**: the page when the action started.
   - **Action**: the exact moment of input. A red dot shows where the click landed.
   - **After**: the page after the action.
   It's a live DOM, not a picture, so you can open DevTools on it, inspect elements and pick a
   locator with the "Pick locator" button to test a better selector.
4. **Bottom/side tabs:**
   - **Call**: the action's parameters, the locator used, timeout, and duration.
   - **Log**: Playwright's step-by-step reasoning, e.g. *"waiting for getByRole('button', {name:
     'Submit'}) … element is not visible … retrying"*. This tab usually explains **why** a step failed.
   - **Errors**: the assertion message, with expected vs. received values.
   - **Console**: browser `console.log` output and errors, e.g. React hydration or runtime errors.
   - **Network**: every request with status, timing and body. Use it to check whether a Server
     Action or Supabase call returned 4xx/5xx, or was just slow.
   - **Source**: your test file, with the current line highlighted.
   - **Attachments** / **Metadata**: screenshots, the browser, viewport (e.g. `mobile` = Pixel 7),
     and the base URL.

### A quick debugging routine

1. Open the report, filter to **failed** or **flaky** tests, and open the trace.
2. Click the **red action**. Read **Errors** (what was expected), then **Log** (what Playwright waited for).
3. Look at the **Before/After snapshots**. Is the element there? Is it covered by a modal or toast?
   Is the page still on the previous URL? A stuck redirect was the cause of the BK-02 flake that led to
   the 10s `expect` timeout.
4. Check **Network** and **Console** for a failed request or a JS error just before the failure.
5. Fix the cause: the app, a missing wait, or a better locator. Re-run with
   `npx playwright test --grep <ID> --trace on`, or `--last-failed`.
