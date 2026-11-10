import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import UebungenPage from "../../app/(app)/training/uebungen/page";
import { TabBar } from "../../app/(app)/tab-bar";

// Server-Client gemockt: zeichnet die Aufrufe je Tabelle auf, `await` liefert das hinterlegte Ergebnis.
const db = vi.hoisted(() => ({
  ergebnisse: {} as Record<string, { data: unknown; error: unknown }>,
  aufrufe: [] as [string, string, unknown[]][],
  user: { id: "u1" } as { id: string } | null,
}));
const pfad = vi.hoisted(() => ({ jetzt: "/training/uebungen" }));
vi.mock("next/navigation", () => ({ usePathname: () => pfad.jetzt }));
vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user } }) },
    from: (tabelle: string) => {
      const kette: object = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") {
              return (ok: (v: unknown) => unknown) => Promise.resolve(db.ergebnisse[tabelle] ?? { data: null, error: null }).then(ok);
            }
            return (...args: unknown[]) => {
              db.aufrufe.push([tabelle, String(prop), args]);
              return kette;
            };
          },
        },
      );
      return kette;
    },
  }),
}));

afterEach(() => {
  cleanup();
  db.ergebnisse = {};
  db.aufrufe = [];
  db.user = { id: "u1" };
});

const uebungen = [
  { id: "1", name: "Liegestütz", category: "bodyweight", muscle_groups: ["brust", "trizeps"], equipment: [] },
  { id: "2", name: "Rudern mit Kurzhantel", category: "kraft", muscle_groups: ["ruecken"], equipment: ["kurzhanteln"] },
  { id: "3", name: "Kniebeuge mit Langhantel", category: "kraft", muscle_groups: ["beine"], equipment: ["langhantel"] },
];
const zeige = async (params: Record<string, string> = {}) => render(await UebungenPage({ searchParams: Promise.resolve(params) }));
const liste = () => within(screen.getByRole("list", { name: "Übungen" })).getAllByRole("listitem");

test("rendert die Liste mit Name, Kategorie und Muskelgruppen", async () => {
  db.ergebnisse.exercises = { data: uebungen, error: null };
  await zeige();
  expect(liste()).toHaveLength(3);
  expect(liste()[0].textContent).toContain("Liegestütz");
  expect(liste()[0].textContent).toContain("Körpergewicht");
  expect(liste()[0].textContent).toContain("Brust, Trizeps");
  expect(db.aufrufe).toContainEqual(["exercises", "order", ["name"]]);
});

test("Filter kommen aus der URL; Kategorie-Links behalten die anderen Parameter", async () => {
  db.ergebnisse.exercises = { data: uebungen, error: null };
  await zeige({ kategorie: "kraft", geraete: "ohne" });
  expect(screen.getByText("Keine Übung passt – lockere einen Filter.")).toBeTruthy();
  const kraft = screen.getByRole("link", { name: "Kraft" });
  expect(kraft.getAttribute("aria-current")).toBe("true");
  expect(screen.getByRole("link", { name: "Cardio" }).getAttribute("href")).toBe("/training/uebungen?kategorie=cardio&geraete=ohne");
});

test("„passend zu meinen Geräten“ nutzt profiles.equipment", async () => {
  db.ergebnisse.exercises = { data: uebungen, error: null };
  db.ergebnisse.profiles = { data: { equipment: ["kurzhanteln"] }, error: null };
  await zeige({ geraete: "meine" });
  expect(liste().map((li) => li.querySelector("h2")?.textContent)).toEqual(["Liegestütz", "Rudern mit Kurzhantel"]);
  expect(db.aufrufe).toContainEqual(["profiles", "eq", ["id", "u1"]]);
});

test("Lesefehler am Profil wird gemeldet statt ungefiltert anzuzeigen", async () => {
  db.ergebnisse.exercises = { data: uebungen, error: null };
  db.ergebnisse.profiles = { data: null, error: { code: "XX000" } };
  await expect(UebungenPage({ searchParams: Promise.resolve({ geraete: "meine" }) })).rejects.toThrow("Geräte");
});

test("Suche geht als Parameter an ilike, Platzhalter in der Eingabe werden maskiert", async () => {
  db.ergebnisse.exercises = { data: [uebungen[1]], error: null };
  await zeige({ suche: "50%_rud" });
  expect(db.aufrufe).toContainEqual(["exercises", "ilike", ["name", "%50\\%\\_rud%"]]);
  expect((screen.getByRole("searchbox", { name: "Übung suchen" }) as HTMLInputElement).value).toBe("50%_rud");
});

test("leerer Katalog zeigt den leeren Zustand", async () => {
  db.ergebnisse.exercises = { data: [], error: null };
  await zeige();
  expect(screen.getByText("Keine Übung passt – lockere einen Filter.")).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Übungen" })).toBeNull();
});

test("Lesefehler zeigt keinen leeren Zustand", async () => {
  db.ergebnisse.exercises = { data: null, error: { code: "XX000" } };
  await expect(zeige()).rejects.toThrow("Übungen");
});

test("Tab „Training“ ist auf der Bibliothek aktiv", () => {
  render(<TabBar />);
  expect(screen.getByRole("link", { name: "Training" }).getAttribute("aria-current")).toBe("page");
});
