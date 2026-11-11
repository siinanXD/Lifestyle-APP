import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import UebungPage from "../../app/(app)/training/uebungen/[slug]/page";
import UebungenPage from "../../app/(app)/training/uebungen/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { varianten } from "../../lib/training/katalog";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, usePathname: () => "/training/uebungen" }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

describe("varianten", () => {
  const u = (slug: string, variant_of: string | null = null) => ({ slug, variant_of });
  const basis = u("liegestuetz", "liegestuetz-fuesse-hoch");
  test("keine", () => expect(varianten(u("plank"), [u("plank"), u("joggen")])).toEqual({ leichter: [], schwerer: [] }));
  test("nur leichter", () => {
    const knie = u("liegestuetz-knie", "liegestuetz");
    expect(varianten(u("liegestuetz"), [u("liegestuetz"), knie])).toEqual({ leichter: [knie], schwerer: [] });
  });
  test("nur schwerer", () => {
    const hoch = u("liegestuetz-fuesse-hoch");
    expect(varianten(basis, [basis, hoch])).toEqual({ leichter: [], schwerer: [hoch] });
  });
  test("beide", () => {
    const knie = u("liegestuetz-knie", "liegestuetz");
    const hoch = u("liegestuetz-fuesse-hoch");
    expect(varianten(basis, [basis, knie, hoch, u("plank")])).toEqual({ leichter: [knie], schwerer: [hoch] });
  });
});

// Seite gegen den Demo-Speicher (lib/demo): derselbe Abfrageweg wie mit Supabase.
describe("Seite", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });
  const zeige = async (slug: string) => render(await UebungPage({ params: Promise.resolve({ slug }) }));

  test("zeigt Name, Kategorie, Muskelgruppen, Geräte, Technik und den Hinweis", async () => {
    await zeige("bankdruecken-kurzhantel");
    expect(screen.getByRole("heading", { level: 1, name: "Bankdrücken mit Kurzhanteln" })).toBeTruthy();
    expect(screen.getByText("Kraft")).toBeTruthy();
    expect(screen.getByText("Brust, Trizeps, Schulter")).toBeTruthy();
    expect(screen.getByText("Kurzhanteln, Flachbank")).toBeTruthy();
    expect(screen.getByText(/Schulterblätter zusammenziehen/)).toBeTruthy();
    expect(screen.getByText("Bei Schmerzen frag bitte ärztlichen Rat; die App stellt keine Diagnosen.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Varianten" })).toBeNull();
  });

  test("ohne Geräte steht „Ohne Geräte“", async () => {
    await zeige("plank");
    expect(screen.getByText("Ohne Geräte")).toBeTruthy();
  });

  test("Varianten in beide Richtungen als Links", async () => {
    fuehreAbfrage("exercises", [{ m: "update", a: [{ variant_of: "kniebeuge-langhantel" }] }, { m: "eq", a: ["slug", "kniebeuge-koerpergewicht"] }]);
    await zeige("kniebeuge-langhantel");
    const v = within(screen.getByRole("region", { name: "Varianten" }));
    expect(v.getByRole("heading", { name: "Leichter" })).toBeTruthy();
    expect(v.getByRole("link", { name: "Kniebeuge (Körpergewicht)" }).getAttribute("href")).toBe("/training/uebungen/kniebeuge-koerpergewicht");
    cleanup();
    await zeige("kniebeuge-koerpergewicht");
    const w = within(screen.getByRole("region", { name: "Varianten" }));
    expect(w.getByRole("heading", { name: "Schwerer" })).toBeTruthy();
    expect(w.getByRole("link", { name: "Kniebeuge mit Langhantel" }).getAttribute("href")).toBe("/training/uebungen/kniebeuge-langhantel");
  });

  test("unbekannter Slug liefert 404", async () => {
    await expect(zeige("gibt-es-nicht")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("die Bibliothek verlinkt auf die Detailseite", async () => {
    render(await UebungenPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: "Joggen" }).getAttribute("href")).toBe("/training/uebungen/joggen");
  });
});
