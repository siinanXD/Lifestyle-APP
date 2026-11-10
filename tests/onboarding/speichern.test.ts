import { expect, test } from "vitest";
import { speichereProfil } from "../../lib/onboarding/speichern";

// Minimaler Client: consents liefert die Zeilen, profiles zeichnet das Update auf.
function fake(consents: { kind: string; revoked_at: string | null }[]) {
  const updates: unknown[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (tabelle: string) =>
      tabelle === "consents"
        ? { select: () => ({ eq: async () => ({ data: consents, error: null }) }) }
        : { update: (felder: unknown) => (updates.push(felder), { eq: async () => ({ error: null }) }) },
  };
  return { client: client as never, updates };
}

test("Profilangaben werden nach widerrufener Einwilligung A nicht gespeichert (alter Tab)", async () => {
  const { client, updates } = fake([{ kind: "A", revoked_at: "2026-11-10T10:00:00Z" }]);
  expect(await speichereProfil(client, { goals: ["kraft"] })).toEqual({ error: { code: "keine_einwilligung" } });
  expect(updates).toEqual([]);
});

test("mit offener Einwilligung A werden Profilangaben gespeichert", async () => {
  const { client, updates } = fake([{ kind: "A", revoked_at: null }]);
  expect(await speichereProfil(client, { goals: ["kraft"] })).toEqual({ error: null });
  expect(updates).toEqual([{ goals: ["kraft"] }]);
});

test("Kontoangaben (Altersbestätigung) gehen ohne Einwilligung A", async () => {
  const { client, updates } = fake([]);
  expect(await speichereProfil(client, { adult_confirmed_at: "2026-11-10T10:00:00Z" })).toEqual({ error: null });
  expect(updates).toHaveLength(1);
});
