import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import GeraetePage from "../../app/(app)/konto/geraete/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import * as onboarding from "../../lib/onboarding/texte";
import { bereinigeGeraete, GERAETE, istGueltigeStufe } from "../../lib/training/geraete";
import { geraetText } from "../../lib/training/katalog";

vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

describe("Regeln", () => {
  test("nur gültige Schlüssel, ohne Dopplungen, feste Reihenfolge", () => {
    expect(bereinigeGeraete(["langhantel", "laufband", "kurzhanteln", "langhantel"])).toEqual(["kurzhanteln", "langhantel"]);
  });
  test("„Nichts, nur ich“ entfernt die anderen", () => expect(bereinigeGeraete(["kurzhanteln", "keine", "studio"])).toEqual(["keine"]));
  test.each([[0, false], [0.2, false], [0.25, true], [2.5, true], [10, true], [11, false], [NaN, false]])("Gewichtsstufe %s gültig: %s", (kg, ok) => {
    expect(istGueltigeStufe(kg)).toBe(ok);
  });
  test("Onboarding und Bibliothek nutzen dieselben Konstanten", () => {
    expect(onboarding.GERAETE).toBe(GERAETE);
    for (const [schluessel, text] of Object.entries(GERAETE)) expect(geraetText(schluessel)).toBe(text);
  });
});

// Seite gegen den Demo-Speicher (lib/demo): derselbe Abfrageweg wie mit Supabase.
describe("Seite /konto/geraete", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });
  const profil = () => (fuehreAbfrage("profiles", [{ m: "select", a: ["equipment, weight_step_kg"] }]).data as { equipment: string[]; weight_step_kg: number }[])[0];
  const haken = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
  const speichern = () => fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

  test("zeigt die gespeicherten Geräte und die Gewichtsstufe", async () => {
    render(await GeraetePage());
    expect(haken("Kurzhanteln").checked).toBe(true);
    expect(haken("Langhantel").checked).toBe(false);
    expect((screen.getByLabelText("Kleinste Gewichtsstufe (kg)") as HTMLInputElement).value).toBe("2,5");
  });

  test("Speichern schreibt Auswahl und Stufe (Komma erlaubt)", async () => {
    render(await GeraetePage());
    fireEvent.click(haken("Langhantel"));
    fireEvent.change(screen.getByLabelText("Kleinste Gewichtsstufe (kg)"), { target: { value: "1,25" } });
    speichern();
    expect((await screen.findByRole("status")).textContent).toBe("Gespeichert.");
    expect(profil()).toEqual({ equipment: ["kurzhanteln", "langhantel"], weight_step_kg: 1.25 });
  });

  test("„Nichts, nur ich“ entfernt die anderen; ein Gerät entfernt „Nichts, nur ich“", async () => {
    render(await GeraetePage());
    fireEvent.click(haken("Nichts, nur ich"));
    expect(haken("Kurzhanteln").checked).toBe(false);
    speichern();
    await screen.findByRole("status");
    expect(profil().equipment).toEqual(["keine"]);
    fireEvent.click(haken("Bänder"));
    expect(haken("Nichts, nur ich").checked).toBe(false);
  });

  test.each(["0", "11", "", "abc"])("Gewichtsstufe „%s“ wird abgelehnt: Meldung, kein Speichern", async (wert) => {
    render(await GeraetePage());
    fireEvent.click(haken("Langhantel"));
    fireEvent.change(screen.getByLabelText("Kleinste Gewichtsstufe (kg)"), { target: { value: wert } });
    speichern();
    expect((await screen.findByRole("alert")).textContent).toContain("0,25 bis 10 kg");
    expect(profil()).toEqual({ equipment: ["kurzhanteln"], weight_step_kg: 2.5 });
  });

  test("ohne Einwilligung A wird nicht gespeichert und auf die Einwilligung verwiesen", async () => {
    fuehreAbfrage("consents", [{ m: "delete", a: [] }, { m: "eq", a: ["kind", "A"] }]);
    render(await GeraetePage());
    fireEvent.click(haken("Langhantel"));
    speichern();
    expect((await screen.findByRole("alert")).textContent).toContain("Einwilligung");
    expect(screen.getByRole("link", { name: "Einwilligung ansehen" }).getAttribute("href")).toBe("/einwilligung/A?next=/konto/geraete");
    expect(profil().equipment).toEqual(["kurzhanteln"]);
  });
});
