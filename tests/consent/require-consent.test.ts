import { beforeEach, expect, test, vi } from "vitest";
import { requireConsent } from "../../lib/consent/require-consent";

const eq = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ select: () => ({ eq }) }) }),
}));

beforeEach(() => vi.clearAllMocks());

test("leitet ohne Einwilligung auf die Einwilligungsseite um und merkt sich die Zielseite", async () => {
  eq.mockResolvedValue({ data: [], error: null });
  await expect(requireConsent("B", "/training?x=1")).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/einwilligung/B?next=%2Ftraining%3Fx%3D1");
});

test("leitet um, wenn die Einwilligung widerrufen ist", async () => {
  eq.mockResolvedValue({ data: [{ kind: "B", revoked_at: "2026-11-01T10:00:00Z" }], error: null });
  await expect(requireConsent("B")).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/einwilligung/B?next=%2F");
});

test("lässt mit offener Einwilligung durch", async () => {
  eq.mockResolvedValue({ data: [{ kind: "B", revoked_at: null }], error: null });
  await requireConsent("B");
  expect(redirect).not.toHaveBeenCalled();
});

test("bei einem Lesefehler wird nicht durchgelassen und nicht umgeleitet", async () => {
  eq.mockResolvedValue({ data: null, error: { code: "XX000" } });
  await expect(requireConsent("B")).rejects.toThrow("Einwilligung");
  expect(redirect).not.toHaveBeenCalled();
});
