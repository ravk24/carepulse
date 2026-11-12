# CarePulse – Project Update

_Last updated: 2026-11-12_

**Live:** https://carepulse-sigma-red.vercel.app · **Branch:** `main` (auto-deploys to Vercel)

## Summary

CarePulse has moved from Appwrite to Supabase. It now has proper admin authentication, private document storage and a faster UI without Sentry. The patient flow (Get Started → Register → Book appointment → Success) works end to end, and production deploys succeed again.

## Completed work

### 1. Database: Appwrite → Supabase
- Replaced `node-appwrite` with `@supabase/supabase-js`. `lib/supabase.config.ts` holds a server-only client that uses the service-role key.
- Added `supabase/schema.sql`, which creates:
  - the `users`, `patients` and `appointments` tables, with foreign keys and cascade deletes;
  - `updated_at` triggers;
  - Row Level Security on every table, with no policies, so the anon key can't read or write data.
- The schema has been applied to the live Supabase project.
- Server actions still return the old document shape (`$id`, `$createdAt`, nested `patient`), so the UI barely changed.
- Fixed a Next.js 14 fetch-cache problem: cached Supabase reads were returning stale or empty results. All Supabase requests now use `cache: "no-store"`.

### 2. Private identity documents
- The `identification-documents` bucket is private, and only the file path is stored.
- `createSignedDocumentUrl()` returns short-lived signed URLs.

### 3. Admin authentication
- Removed the client-side passkey (`NEXT_PUBLIC_ADMIN_PASSKEY`). Admins now sign in with email and password through Supabase Auth.
- Admin status is `app_metadata.role = "admin"`. It is checked in three places:
  - `middleware.ts`;
  - the admin page (`requireAdminPage`);
  - every admin-only server action (`assertAdmin`).
- The admin account was created from the credentials in `.env.local` and verified both locally and on the live site.
- The dashboard header shows the admin's email and a Sign out button.

### 4. Performance and accessibility
- Removed Sentry completely: SDK, config files, instrumentation and example API route.
- Removed `next-themes`. Dark mode is now rendered on the server, which also fixed the black-text-on-dark-background bug.
- Code-split the heavy form fields (date picker, select, checkbox), lazy-loaded the admin login modal, and optimised images (AVIF/WebP, `sizes`, `priority`).
- Lighthouse on mobile went from 80 to about 94 for Performance. Desktop Performance is 99, and Accessibility, Best Practices and SEO are all 100.

### 5. Bug fixes and UI
- "Get Started" works again. It had failed because the database tables were missing.
- Fixed booking appointments, which wrongly fell through to the admin-only update path. Errors are now shown to the user.
- The success page shows an "Appointment not found" state instead of crashing.
- The CarePulse logo links to the home page on every page.
- The footer reads "© 2025 CarePulse", and the "CarePluse" typo is fixed everywhere.
- Fixed the "Submit Apppointment" button typo.
- Replaced the doctor list with 12 new doctors. Stock photos are replaced by initials avatars (`DoctorAvatar`).

### 6. Deployment
- Fixed failing Vercel builds:
  - the Supabase environment variables were missing in Vercel;
  - Node 20.x is discontinued, so `package.json` now pins `engines.node` to `24.x`.
- Rewrote `README.md`: setup, environment variables, schema, admin creation, deployment and troubleshooting.

## Pending (owner action required)

| Item | Action |
| --- | --- |
| SMS notifications | Buy or claim a Twilio phone number and set it as `TWILIO_PHONE_NUMBER` locally and in Vercel. The current value is a personal number, which causes error 21266. Enable India under Messaging → Geo permissions. A trial account can only text verified numbers. |
| Vercel Node version | Set Project Settings → Node.js Version to 24.x, so dashboard redeploys of old commits don't fail. |
| Old env vars | Delete stale Vercel variables, especially `NEXT_PUBLIC_ADMIN_PASSKEY` and the Appwrite and Sentry keys. |
| Sentry token | Revoke the old Sentry auth token. |
| Supabase sign-ups | Authentication → turn off "Allow new users to sign up". |
| Old branch | Optionally delete the `supabase-migration` branch, which is already merged. |
| Appointment deletions | Several appointments were deleted outside the app. Check whether that was intentional. |

## Known limitations / next steps

- **Patients have no login.** Patient pages are reached by UUIDs in the URL. Adding patient authentication (email or SMS one-time codes) is the main step before using the app with real patient data.
- The doctor list is a hardcoded constant in `constants/index.ts`.
- OpenSpec CLI 2.0.0 is installed globally but not yet initialised in this repo (`openspec init`).
