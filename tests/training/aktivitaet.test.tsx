import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AktivitaetPage from "../../app/(app)/training/aktivitaet/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { pruefeAktivitaet, type Eingabe } from "../../lib/training/aktivitaet";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const requireConsent = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../lib/consent/require-consent", () => ({ requireConsent }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

const gueltig: Eingabe = { kategorie: "cardio", aktivitaet: " Joggen ", dauerMin: "30", streckeKm: "5,2", anstrengung: 6, notiz: " locker " };
const fehler = (e: Partial<Eingabe>) => {
  const r = pruefeAktivitaet({ ...gueltig, ...e });
  return r.ok ? [] : r.fehler;
};

describe("pruefeAktivitaet", () => {
  test("gültige Eingaben gehen durch: getrimmt, Komma als Dezimalzeichen", () => {
    expect(pruefeAktivitaet(gueltig)).toEqual({
      ok: true,
      werte: { category: "cardio", activity: "Joggen", duration_min: 30, distance_km: 5.2, effort: 6, note: "locker" },
    });
  });
  test("freiwillige Felder leer: null", () => {
    expect(pruefeAktivitaet({ ...gueltig, streckeKm: "", anstrengung: null, notiz: "" })).toMatchObject({
      ok: true,
      werte: { distance_km: null, effort: null, note: null },
    });
  });
  test.each(["0", "1441", "", "12,5", "abc"])("Dauer „%s“ wird abgelehnt", (dauerMin) => expect(fehler({ dauerMin })).toEqual(["dauer"]));
  test.each(["1", "1440"])("Dauer %s ist gültig", (dauerMin) => expect(fehler({ dauerMin })).toEqual([]));
  test.each(["-1", "1001", "abc"])("Strecke „%s“ wird abgelehnt", (streckeKm) => expect(fehler({ streckeKm })).toEqual(["strecke"]));
  test.each([0, 11, 5.5])("Anstrengung %s wird abgelehnt", (anstrengung) => expect(fehler({ anstrengung })).toEqual(["anstrengung"]));
  test("leere oder zu lange Aktivität wird abgelehnt", () => {
    expect(fehler({ aktivitaet: "   " })).toEqual(["aktivitaet"]);
    expect(fehler({ aktivitaet: "x".repeat(61) })).toEqual(["aktivitaet"]);
  });
  test("unbekannte Kategorie und zu lange Notiz werden abgelehnt", () => {
    expect(fehler({ kategorie: "yoga" })).toEqual(["kategorie"]);
    expect(fehler({ notiz: "x".repeat(201) })).toEqual(["notiz"]);
  });
  test("Strecke bei Mobility wird verworfen", () => {
    expect(pruefeAktivitaet({ ...gueltig, kategorie: "mobility", streckeKm: "3" })).toMatchObject({ ok: true, werte: { distance_km: null } });
  });
  test("mehrere Fehler kommen zusammen zurück", () => expect(fehler({ dauerMin: "0", aktivitaet: "" })).toEqual(["aktivitaet", "dauer"]));
});

// Seite gegen den Demo-Speicher (lib/demo): derselbe Abfrageweg wie mit Supabase.
describe("Seite /training/aktivitaet", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
    requireConsent.mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });
  const zeilen = () => fuehreAbfrage("activity_logs", [{ m: "select", a: ["*"] }]).data as Record<string, unknown>[];

  test("ohne Einwilligung B wird umgeleitet und nichts geladen", async () => {
    requireConsent.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(AktivitaetPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(requireConsent).toHaveBeenCalledWith("B", "/training/aktivitaet");
  });

  test("Schnellwahl zeigt die Katalog-Übungen der Kategorie; Speichern legt den Eintrag an und führt zum Verlauf", async () => {
    render(await AktivitaetPage());
    const schnell = within(screen.getByLabelText("Schnellwahl"));
    expect(schnell.getAllByRole("button").map((b) => b.textContent)).toEqual(["Joggen"]);
    fireEvent.click(schnell.getByRole("button", { name: "Joggen" }));
    fireEvent.change(screen.getByLabelText("Dauer (Minuten)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Strecke in km (freiwillig)"), { target: { value: "5,2" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/training/verlauf"));
    expect(zeilen()).toMatchObject([{ category: "cardio", activity: "Joggen", duration_min: 30, distance_km: 5.2, effort: null, note: null }]);
  });

  test("Mobility hat kein Streckenfeld; freie Eingabe und Anstrengung werden gespeichert", async () => {
    render(await AktivitaetPage());
    fireEvent.click(screen.getByRole("button", { name: "Mobility" }));
    expect(screen.queryByLabelText("Strecke in km (freiwillig)")).toBeNull();
    fireEvent.change(screen.getByLabelText("Was hast du gemacht?"), { target: { value: "Yoga" } });
    fireEvent.change(screen.getByLabelText("Dauer (Minuten)"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/Gefühlte Anstrengung/), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(zeilen()).toMatchObject([{ category: "mobility", activity: "Yoga", duration_min: 20, distance_km: null, effort: 4 }]);
  });

  test("ungültige Eingabe: Meldungen, kein Speichern", async () => {
    render(await AktivitaetPage());
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    const meldung = (await screen.findByRole("alert")).textContent;
    expect(meldung).toContain("was du gemacht hast");
    expect(meldung).toContain("1 bis 1440 Minuten");
    expect(zeilen()).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
  });
});
