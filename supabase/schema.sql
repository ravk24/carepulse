-- CarePulse schema for Supabase. Run this in the Supabase SQL editor (or `supabase db push`).
-- Columns are quoted camelCase so they match the field names used across the app.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  phone       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.patients (
  id                          uuid primary key default gen_random_uuid(),
  "userId"                    uuid not null unique references public.users(id) on delete cascade,
  name                        text not null,
  email                       text not null,
  phone                       text not null,
  "birthDate"                 timestamptz,
  gender                      text check (gender in ('male', 'female', 'other')),
  address                     text,
  occupation                  text,
  "emergencyContactName"      text,
  "emergencyContactNumber"    text,
  "primaryPhysician"          text,
  "insuranceProvider"         text,
  "insurancePolicyNumber"     text,
  allergies                   text,
  "currentMedication"         text,
  "familyMedicalHistory"      text,
  "pastMedicalHistory"        text,
  "identificationType"        text,
  "identificationNumber"      text,
  "identificationDocumentId"  text,
  "privacyConsent"            boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table if not exists public.appointments (
  id                   uuid primary key default gen_random_uuid(),
  "patientId"          uuid not null references public.patients(id) on delete cascade,
  "userId"             uuid not null references public.users(id) on delete cascade,
  schedule             timestamptz not null,
  status               text not null default 'pending' check (status in ('pending', 'scheduled', 'cancelled')),
  "primaryPhysician"   text not null,
  reason               text not null,
  note                 text,
  "cancellationReason" text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists appointments_created_at_idx on public.appointments (created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists patients_updated_at on public.patients;
create trigger patients_updated_at before update on public.patients for each row execute function public.set_updated_at();
drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();

-- RLS on with no policies: only the server (service role key) can read/write. Nothing is exposed to the anon key.
alter table public.users        enable row level security;
alter table public.patients     enable row level security;
alter table public.appointments enable row level security;

-- Private storage bucket for identification documents. No storage policies are added,
-- so files can only be read through short-lived signed URLs created by the server.
insert into storage.buckets (id, name, public)
values ('identification-documents', 'identification-documents', false)
on conflict (id) do update set public = false;

-- If you ran an earlier version of this script: the public URL column is no longer used.
alter table public.patients drop column if exists "identificationDocumentUrl";

-- ─── Admin accounts ──────────────────────────────────────────────────────────
-- 1. Dashboard -> Authentication -> Users -> "Add user" (email + password, auto-confirm).
-- 2. Grant the admin role (app_metadata can't be edited by users themselves):
--      update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
--      where email = 'admin@example.com';
-- 3. Recommended: Authentication -> Sign In / Providers -> turn off "Allow new users to sign up",
--    since only admins use Supabase Auth in this app.
-- To revoke: update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where email = '...';
