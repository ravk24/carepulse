import { afterAll, describe, expect, it } from "vitest";

import { getRecentAppointmentList, updateAppointment } from "@/lib/actions/appointment.actions";
import { db, sql } from "../support/db";
import { makeAppointment, signInAsAdmin } from "../support/factories";

// DB: backend data checks in raw SQL, straight against the local Supabase Postgres (node-postgres,
// superuser, so RLS doesn't hide anything). The app writes through its server actions; these tests
// then check what actually landed in the tables, plus the schema guarantees the app relies on
// (constraints, cascades, triggers, RLS, private bucket).

const createdUserIds: string[] = [];
afterAll(async () => {
  await sql(`delete from public.users where id = any($1::uuid[])`, [createdUserIds]); // cascades
  await db.end();
});

const booked = async () => {
  const data = await makeAppointment();
  createdUserIds.push(data.user.$id);
  return data;
};

// Postgres error code of a failing statement (e.g. 23514 check_violation)
const sqlError = (text: string, params: unknown[]) =>
  sql(text, params).then(
    () => null,
    (e: { code: string; constraint?: string }) => ({ code: e.code, constraint: e.constraint })
  );

describe("Backend data checks in SQL (DB)", () => {
  it("DB-01 a booking writes exactly one appointment, linked to the right patient and user, with defaults", async () => {
    const { user, patient, appointment } = await booked();

    const rows = await sql(
      `select a.status, a.schedule, a.reason, a.note, a."cancellationReason",
              p.id as patient_id, u.id as user_id, u.email
         from public.appointments a
         join public.patients p on p.id = a."patientId"
         join public.users u    on u.id = a."userId" and u.id = p."userId"
        where a.id = $1`,
      [appointment.$id]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      status: "pending",
      schedule: new Date("2030-01-15T10:00:00Z"),
      reason: "Back pain",
      note: "Mornings please",
      cancellationReason: null,
      patient_id: patient.$id,
      user_id: user.$id,
      email: user.email,
    });
    const [{ count }] = await sql<{ count: number }>(
      `select count(*)::int as count from public.appointments where "userId" = $1`,
      [user.$id]
    );
    expect(count).toBe(1);
  });

  it("DB-02 the admin scheduling an appointment updates the row in place (status, doctor, time, updated_at)", async () => {
    const { user, appointment } = await booked();
    const [before] = await sql(`select created_at, updated_at from public.appointments where id = $1`, [appointment.$id]);

    await signInAsAdmin();
    const result = await updateAppointment({
      appointmentId: appointment.$id,
      userId: user.$id,
      timeZone: "UTC",
      type: "schedule",
      appointment: { primaryPhysician: "Atul Goel", schedule: new Date("2030-02-01T09:30:00Z"), status: "scheduled" } as any,
    });
    expect(result?.appointment).toBeTruthy();

    const [after] = await sql(
      `select status, "primaryPhysician", schedule, created_at, updated_at from public.appointments where id = $1`,
      [appointment.$id]
    );
    expect(after).toMatchObject({
      status: "scheduled",
      primaryPhysician: "Atul Goel",
      schedule: new Date("2030-02-01T09:30:00Z"),
      created_at: before.created_at, // same row, not a new one
    });
    expect((after.updated_at as Date).getTime()).toBeGreaterThan((before.updated_at as Date).getTime());
  });

  it("DB-03 the admin dashboard's totals equal a GROUP BY over the appointments table", async () => {
    await booked();
    await signInAsAdmin();
    const dashboard = await getRecentAppointmentList();

    const rows = await sql<{ status: string; count: number }>(
      `select status, count(*)::int as count from public.appointments group by status`
    );
    const bySql = Object.fromEntries(rows.map((r) => [r.status, r.count]));

    expect(dashboard).toMatchObject({
      totalCount: rows.reduce((sum, r) => sum + r.count, 0),
      scheduledCount: bySql.scheduled ?? 0,
      pendingCount: bySql.pending ?? 0,
      cancelledCount: bySql.cancelled ?? 0,
    });
  });

  it("DB-04 data integrity across ALL rows: no appointment points at another user's patient, no cancellation without a reason", async () => {
    await booked();

    const mismatched = await sql(
      `select a.id from public.appointments a
         join public.patients p on p.id = a."patientId"
        where a."userId" <> p."userId"`
    );
    const cancelledWithoutReason = await sql(
      `select id from public.appointments
        where status = 'cancelled' and coalesce(trim("cancellationReason"), '') = ''`
    );
    const duplicateEmails = await sql(
      `select lower(email) from public.users group by lower(email) having count(*) > 1`
    );

    expect(mismatched).toEqual([]);
    expect(cancelledWithoutReason).toEqual([]);
    expect(duplicateEmails).toEqual([]); // the unique index is case-sensitive; this catches Foo@ vs foo@
  });

  it("DB-05 required columns are NOT NULL in the schema", async () => {
    const rows = await sql<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and table_name in ('users', 'patients', 'appointments')
          and is_nullable = 'NO'
        order by table_name, column_name`
    );
    const notNull = (table: string) => rows.filter((r) => r.table_name === table).map((r) => r.column_name);

    expect(notNull("users")).toEqual(["created_at", "email", "id", "name", "phone", "updated_at"]);
    expect(notNull("patients")).toEqual(
      expect.arrayContaining(["id", "userId", "name", "email", "phone", "privacyConsent"])
    );
    expect(notNull("appointments")).toEqual(
      expect.arrayContaining(["id", "patientId", "userId", "schedule", "status", "primaryPhysician", "reason"])
    );
  });

  it("DB-06 unique, foreign-key (ON DELETE CASCADE) and check constraints exist", async () => {
    const rows = await sql<{ table: string; type: string; on_delete: string; definition: string }>(
      `select conrelid::regclass::text as table, contype as type, confdeltype as on_delete,
              pg_get_constraintdef(oid) as definition
         from pg_constraint
        where connamespace = 'public'::regnamespace and contype in ('u', 'f', 'c')`
    );
    const has = (table: string, type: string, pattern: RegExp) =>
      rows.some((r) => r.table === table && r.type === type && pattern.test(r.definition));

    expect(has("users", "u", /UNIQUE \(email\)/)).toBe(true);
    expect(has("patients", "u", /UNIQUE \("userId"\)/)).toBe(true); // one patient record per user
    expect(has("patients", "c", /gender.*male.*female.*other/)).toBe(true);
    expect(has("appointments", "c", /status.*pending.*scheduled.*cancelled/)).toBe(true);

    const fks = rows.filter((r) => r.type === "f").map((r) => `${r.table} ${r.definition} ${r.on_delete}`);
    expect(fks).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^patients FOREIGN KEY \("userId"\) REFERENCES users\(id\) ON DELETE CASCADE c$/),
        expect.stringMatching(/^appointments FOREIGN KEY \("patientId"\) REFERENCES patients\(id\) ON DELETE CASCADE c$/),
        expect.stringMatching(/^appointments FOREIGN KEY \("userId"\) REFERENCES users\(id\) ON DELETE CASCADE c$/),
      ])
    );
  });

  it("DB-07 the database itself rejects bad data, whatever the app sends", async () => {
    const { user, patient } = await booked();
    const insert = `insert into public.appointments ("patientId", "userId", schedule, status, "primaryPhysician", reason)
                    values ($1, $2, now(), $3, 'Ashok Seth', 'x')`;

    expect(await sqlError(insert, [patient.$id, user.$id, "done"])).toMatchObject({ code: "23514" }); // check_violation
    expect(await sqlError(insert, [crypto.randomUUID(), user.$id, "pending"])).toMatchObject({ code: "23503" }); // foreign_key_violation
    expect(
      await sqlError(`insert into public.users (name, email, phone) values ('Dup', $1, '+15551234567')`, [user.email])
    ).toMatchObject({ code: "23505", constraint: "users_email_key" }); // unique_violation
    expect(
      await sqlError(`update public.patients set gender = 'unknown' where id = $1`, [patient.$id])
    ).toMatchObject({ code: "23514" });
  });

  it("DB-08 deleting a user cascades to their patient record and appointments", async () => {
    const { user, patient, appointment } = await booked();

    await sql(`delete from public.users where id = $1`, [user.$id]);

    const [left] = await sql<{ patients: number; appointments: number }>(
      `select (select count(*)::int from public.patients where id = $1) as patients,
              (select count(*)::int from public.appointments where id = $2) as appointments`,
      [patient.$id, appointment.$id]
    );
    expect(left).toEqual({ patients: 0, appointments: 0 });
  });

  it("DB-09 RLS is on for every table with NO policies, so only the service role can read or write", async () => {
    const tables = await sql<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace and relname in ('users', 'patients', 'appointments')
        order by relname`
    );
    const policies = await sql(`select policyname, tablename from pg_policies where schemaname = 'public'`);

    expect(tables).toEqual([
      { relname: "appointments", relrowsecurity: true },
      { relname: "patients", relrowsecurity: true },
      { relname: "users", relrowsecurity: true },
    ]);
    expect(policies).toEqual([]);
  });

  it("DB-10 the ID document bucket is private and only the admin accounts carry the admin role", async () => {
    const [bucket] = await sql(`select public from storage.buckets where id = $1`, [process.env.SUPABASE_BUCKET]);
    expect(bucket).toEqual({ public: false });

    const admins = await sql<{ email: string }>(
      `select email from auth.users where raw_app_meta_data ->> 'role' = 'admin' order by email`
    );
    expect(admins.map((a) => a.email)).toEqual(
      [process.env.TEST_ADMIN_EMAIL, process.env.TEST_SIGNOUT_ADMIN_EMAIL].sort()
    );
    const [nonAdmin] = await sql(`select raw_app_meta_data ->> 'role' as role from auth.users where email = $1`, [
      process.env.TEST_USER_EMAIL,
    ]);
    expect(nonAdmin).toEqual({ role: null });
  });
});
