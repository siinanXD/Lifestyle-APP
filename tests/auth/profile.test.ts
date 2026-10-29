// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { callbackUrl, ensureProfile, safeNext } from "../../lib/auth/profile";

describe("ensureProfile", () => {
  test("legt nur die eigene Zeile an und lässt eine vorhandene unberührt", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    await ensureProfile({ from } as never, "u1");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(upsert).toHaveBeenCalledWith({ id: "u1" }, { onConflict: "id", ignoreDuplicates: true });
  });
});

describe("safeNext", () => {
  test.each([
    ["/passwort-neu", "/passwort-neu"],
    ["/", "/"],
    [null, "/"],
    ["", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
  ])("%s → %s", (input, expected) => expect(safeNext(input)).toBe(expected));
});

test("callbackUrl nutzt die eigene Origin", () => {
  expect(callbackUrl("/passwort-neu")).toBe(`${window.location.origin}/auth/callback?next=%2Fpasswort-neu`);
});
