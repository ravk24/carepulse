import { describe, expect, it } from "vitest";

import { cn, formatDateTime, parseStringify } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and lets later Tailwind classes win", () => {
    expect(cn("p-2", false && "hidden", "p-4")).toBe("p-4");
  });
});

describe("parseStringify", () => {
  it("returns a deep copy", () => {
    const original = { a: { b: [1, 2] } };
    const copy = parseStringify(original);
    expect(copy).toEqual(original);
    expect(copy.a).not.toBe(original.a);
  });

  it("turns Dates into ISO strings (what server actions return to the client)", () => {
    expect(parseStringify({ d: new Date("2025-01-02T03:04:05Z") })).toEqual({
      d: "2025-01-02T03:04:05.000Z",
    });
  });
});

describe("formatDateTime", () => {
  // Always pass an explicit time zone: otherwise the output depends on the machine running the test
  const date = "2025-03-09T14:30:00Z";

  it("formats in UTC", () => {
    expect(formatDateTime(date, "UTC")).toEqual({
      dateTime: "Mar 9, 2025, 2:30 PM",
      dateDay: "Sun, 03/09/2025",
      dateOnly: "Mar 9, 2025",
      timeOnly: "2:30 PM",
    });
  });

  it("respects the given time zone", () => {
    expect(formatDateTime(date, "Asia/Kolkata").timeOnly).toBe("8:00 PM");
  });

  it("accepts a Date object", () => {
    expect(formatDateTime(new Date(date), "UTC").dateOnly).toBe("Mar 9, 2025");
  });
});
