-- Test seed data (local Supabase only; applied after schema.sql by `supabase db reset`).
-- Kept minimal on purpose: each test creates the rows it needs with unique emails,
-- so tests stay independent and can run in parallel. The admin auth user is created
-- by the test global setup through the Auth admin API (tests/support/admin.ts).
select 1;
