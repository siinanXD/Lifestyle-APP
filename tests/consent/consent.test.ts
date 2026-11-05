import { describe, expect, test, vi } from "vitest";
import { erteileEinwilligung, hatEinwilligung, widerrufeEinwilligung } from "../../lib/consent/consent";
import { EINWILLIGUNGSTEXTE } from "../../lib/consent/texte";

describe("hatEinwilligung", () => {
  test("offene Zeile der Art zählt", () => {
    expect(hatEinwilligung([{ kind: "B", revoked_at: null }], "B")).toBe(true);
  });
  test("widerrufene Zeile zählt nicht", () => {
    expect(hatEinwilligung([{ kind: "B", revoked_at: "2026-11-01T10:00:00Z" }], "B")).toBe(false);
  });
  test("mehrere Zeilen: eine neue offene nach einem Widerruf reicht", () => {
    const zeilen = [
      { kind: "B", revoked_at: "2026-11-01T10:00:00Z" },
      { kind: "B", revoked_at: null },
    ];
    expect(hatEinwilligung(zeilen, "B")).toBe(true);
  });
  test("andere Art zählt nicht", () => {
    expect(hatEinwilligung([{ kind: "A", revoked_at: null }], "B")).toBe(false);
  });
  test("keine Zeilen", () => {
    expect(hatEinwilligung([], "A")).toBe(false);
  });
});

const getUser = vi.fn();
function clientMit(ergebnis: { error: { code?: string } | null }) {
  const insert = vi.fn().mockResolvedValue(ergebnis);
  const is = vi.fn().mockResolvedValue(ergebnis);
  const eq = vi.fn(() => ({ is }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ insert, update }));
  // Nur die benutzten Teile des Clients; der Typ-Cast bleibt im Test.
  const supabase = { from, auth: { getUser } } as never;
  return { supabase, from, insert, update, eq, is };
}

describe("erteileEinwilligung", () => {
  test("speichert Art und Textversion für die angemeldete Person", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { supabase, from, insert } = clientMit({ error: null });
    const result = await erteileEinwilligung(supabase, "B");
    expect(result.error).toBeNull();
    expect(from).toHaveBeenCalledWith("consents");
    expect(insert).toHaveBeenCalledWith({ user_id: "u1", kind: "B", text_version: EINWILLIGUNGSTEXTE.B.version });
  });
  test("schon offene Einwilligung (Doppelklick) gilt als erteilt", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { supabase } = clientMit({ error: { code: "23505" } });
    expect((await erteileEinwilligung(supabase, "B")).error).toBeNull();
  });
  test("anderer Datenbankfehler wird gemeldet", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { supabase } = clientMit({ error: { code: "42501" } });
    expect((await erteileEinwilligung(supabase, "B")).error).not.toBeNull();
  });
  test("ohne Anmeldung wird nichts gespeichert", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { supabase, insert } = clientMit({ error: null });
    expect((await erteileEinwilligung(supabase, "B")).error).not.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("widerrufeEinwilligung", () => {
  test("setzt revoked_at nur an der offenen Zeile der Art", async () => {
    const { supabase, update, eq, is } = clientMit({ error: null });
    const result = await widerrufeEinwilligung(supabase, "C");
    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ revoked_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    expect(eq).toHaveBeenCalledWith("kind", "C");
    expect(is).toHaveBeenCalledWith("revoked_at", null);
  });
});
