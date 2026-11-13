import { describe, expect, it } from "vitest";

import { isAdminUser } from "@/lib/auth";
import { toDocument } from "@/lib/supabase.config";

describe("toDocument", () => {
  it("maps Supabase columns to the old Appwrite document shape", () => {
    expect(toDocument({ id: "1", created_at: "c", updated_at: "u", name: "Jo" })).toEqual({
      $id: "1",
      $createdAt: "c",
      $updatedAt: "u",
      name: "Jo",
    });
  });

  it("passes null through", () => {
    expect(toDocument(null)).toBeNull();
  });
});

describe("isAdminUser", () => {
  it.each([
    [{ app_metadata: { role: "admin" } }, true],
    [{ app_metadata: { role: "user" } }, false],
    [{ app_metadata: {} }, false],
    // user_metadata can be edited by the user themselves, so it must NOT grant admin
    [{ app_metadata: {}, user_metadata: { role: "admin" } }, false],
    [null, false],
    [undefined, false],
  ])("case %# -> %s", (user, expected) => {
    expect(isAdminUser(user as any)).toBe(expected);
  });
});
