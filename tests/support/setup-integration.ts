import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { cookieJar } from "./cookies";
import { server } from "./msw";

// Runs in each test worker before the test file is imported, so lib/supabase.config.ts
// sees the LOCAL Supabase URL/keys when it creates its client.
process.loadEnvFile(".env.test");

// ---- Next.js request APIs (there is no Next server in these tests) ----
// vi.mock calls are hoisted above imports, so factories import what they need themselves.

vi.mock("next/headers", async () => {
  const { cookieJar } = await import("./cookies");
  return {
    cookies: async () => ({
      getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) =>
        value ? cookieJar.set(name, value) : cookieJar.delete(name),
    }),
  };
});

// revalidatePath needs Next's internal request store; it's a no-op for these tests
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

// ---- MSW: fake Twilio API (real Supabase traffic passes through untouched) ----
beforeAll(() => server.listen({ onUnhandledFrame: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  cookieJar.clear();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());
