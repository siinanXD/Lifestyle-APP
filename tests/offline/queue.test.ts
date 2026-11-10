import { describe, expect, test } from "vitest";
import { MAX_VERSUCHE, neuerEintrag, verarbeite, wartezeitMs, type Eintrag, type Senden, type Speicher } from "../../lib/offline/queue";

// In-Memory-Speicher mit demselben Verhalten wie die IndexedDB-Fassung; nur erfundene Daten.
function imSpeicher(start: Eintrag[] = []): Speicher {
  const zeilen = new Map(start.map((e) => [e.id, e]));
  return {
    alle: async () => [...zeilen.values()],
    hinzufuegen: async (e) => void zeilen.set(e.id, e),
    entfernen: async (id) => void zeilen.delete(id),
    aktualisieren: async (e) => void (zeilen.has(e.id) && zeilen.set(e.id, e)),
    leeren: async () => zeilen.clear(),
  };
}

const eintrag = (id: string, sekunde: number, mehr: Partial<Eintrag> = {}): Eintrag => ({
  id,
  art: "satz",
  daten: { satzNr: sekunde },
  erstelltAm: new Date(Date.UTC(2026, 0, 1, 10, 0, sekunde)).toISOString(),
  versuche: 0,
  ...mehr,
});
const JETZT = Date.UTC(2026, 0, 1, 12);
const OK = { ok: true } as const;
const NETZ = { ok: false, fehler: "netz" } as const;

// Sendefunktion, die mitschreibt, welche ids in welcher Reihenfolge dran waren.
function sender(antwort: (e: Eintrag) => ReturnType<Senden> | Awaited<ReturnType<Senden>> = () => OK) {
  const gesendet: string[] = [];
  const senden: Senden = async (e) => {
    gesendet.push(e.id);
    return antwort(e);
  };
  return { senden, gesendet };
}

describe("verarbeite", () => {
  test("sendet in der Reihenfolge von erstelltAm und entfernt Gesendetes", async () => {
    const queue = imSpeicher([eintrag("c", 3), eintrag("a", 1), eintrag("b", 2)]);
    const { senden, gesendet } = sender();
    const stand = await verarbeite(queue, senden, () => JETZT);
    expect(gesendet).toEqual(["a", "b", "c"]);
    expect(stand).toEqual({ gesendet: 3, offen: 0, fehlgeschlagen: 0 });
    expect(await queue.alle()).toEqual([]);
  });

  test.each([
    ["als Ergebnis", () => NETZ],
    ["als Exception", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])("Netzfehler (%s) stoppt, der Rest bleibt unangetastet", async (_, netzfehler) => {
    const queue = imSpeicher([eintrag("a", 1), eintrag("b", 2), eintrag("c", 3)]);
    const { senden, gesendet } = sender((e) => (e.id === "b" ? netzfehler() : OK));
    const stand = await verarbeite(queue, senden, () => JETZT);
    expect(gesendet).toEqual(["a", "b"]);
    expect(stand).toEqual({ gesendet: 1, offen: 2, fehlgeschlagen: 0 });
    const rest = await queue.alle();
    expect(rest.map((e) => [e.id, e.versuche])).toEqual([["b", 1], ["c", 0]]);
    expect(rest[0].naechsterVersuchAb).toBe(new Date(JETZT + wartezeitMs(1)).toISOString());
  });

  test("dauerhafter Fehler (4xx: RLS, Validierung) wandert in fehlgeschlagen, die übrigen laufen weiter", async () => {
    const queue = imSpeicher([eintrag("a", 1), eintrag("b", 2)]);
    const stand = await verarbeite(queue, sender((e) => (e.id === "a" ? { ok: false, fehler: "42501" } : OK)).senden, () => JETZT);
    expect(stand).toEqual({ gesendet: 1, offen: 0, fehlgeschlagen: 1 });
    expect(await queue.alle()).toEqual([{ ...eintrag("a", 1), versuche: 1, fehlgeschlagen: "42501" }]);

    // Fehlgeschlagenes wird nicht endlos wiederholt.
    const { senden, gesendet } = sender();
    await verarbeite(queue, senden, () => JETZT);
    expect(gesendet).toEqual([]);
  });

  test("Wiederholung nach Netzfehler: erst nach der Wartezeit, nach Erfolg entfernt", async () => {
    const queue = imSpeicher([eintrag("a", 1), eintrag("b", 2)]);
    await verarbeite(queue, async () => NETZ, () => JETZT);

    const { senden, gesendet } = sender();
    await verarbeite(queue, senden, () => JETZT + wartezeitMs(1) - 1);
    expect(gesendet).toEqual([]); // zu früh: auch "b" wartet, damit die Reihenfolge bleibt

    expect(await verarbeite(queue, senden, () => JETZT + wartezeitMs(1))).toEqual({ gesendet: 2, offen: 0, fehlgeschlagen: 0 });
    expect(gesendet).toEqual(["a", "b"]);
  });

  test("Wartezeit wächst exponentiell", () => {
    expect([1, 2, 3, 4].map(wartezeitMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
  });

  test(`${MAX_VERSUCHE} Versuche → fehlgeschlagen`, async () => {
    const queue = imSpeicher([eintrag("a", 1)]);
    let jetzt = JETZT;
    const { senden, gesendet } = sender(() => NETZ);
    for (let i = 0; i < MAX_VERSUCHE + 3; i++) {
      await verarbeite(queue, senden, () => jetzt);
      jetzt += wartezeitMs(MAX_VERSUCHE);
    }
    expect(gesendet).toHaveLength(MAX_VERSUCHE);
    expect(await queue.alle()).toMatchObject([{ id: "a", versuche: MAX_VERSUCHE, fehlgeschlagen: "netz" }]);
  });

  test("Absturz nach dem Senden, vor dem Entfernen: zweiter Lauf sendet dieselbe id erneut, es bleibt eine Zeile", async () => {
    const speicher = imSpeicher([eintrag("a", 1)]);
    const abstuerzend: Speicher = { ...speicher, entfernen: async () => Promise.reject(new Error("Absturz")) };
    const server = new Map<string, unknown>(); // Upsert auf id, wie es SIN-1287 serverseitig verlangt
    const { senden } = sender((e) => (server.set(e.id, e.daten), OK));

    await expect(verarbeite(abstuerzend, senden, () => JETZT)).rejects.toThrow("Absturz");
    expect(await speicher.alle()).toEqual([eintrag("a", 1)]);

    expect(await verarbeite(speicher, senden, () => JETZT)).toEqual({ gesendet: 1, offen: 0, fehlgeschlagen: 0 });
    expect([...server]).toEqual([["a", { satzNr: 1 }]]);
  });

  test("ein während des Sendens geleerter Speicher (Abmelden) bleibt leer", async () => {
    const queue = imSpeicher([eintrag("a", 1)]);
    await verarbeite(queue, sender(() => queue.leeren().then(() => NETZ)).senden, () => JETZT);
    expect(await queue.alle()).toEqual([]);
  });

  test("leeren() entfernt alles, auch Fehlgeschlagenes", async () => {
    const queue = imSpeicher([eintrag("a", 1), eintrag("b", 2, { fehlgeschlagen: "42501" })]);
    await queue.leeren();
    expect(await queue.alle()).toEqual([]);
    expect(await verarbeite(queue, sender().senden, () => JETZT)).toEqual({ gesendet: 0, offen: 0, fehlgeschlagen: 0 });
  });
});

describe("neuerEintrag", () => {
  test("vergibt Client-UUID und streng steigende Zeitstempel, auch in derselben Millisekunde", () => {
    const [a, b, c] = [neuerEintrag("workout_start", {}), neuerEintrag("satz", {}), neuerEintrag("workout_ende", {})];
    expect(a).toMatchObject({ art: "workout_start", daten: {}, versuche: 0 });
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    expect(a.erstelltAm < b.erstelltAm && b.erstelltAm < c.erstelltAm).toBe(true);
  });
});

describe("verarbeite nach leeren()", () => {
  test("sendet nach dem Abmelden mitten im Durchgang nichts mehr", async () => {
    const queue = imSpeicher([eintrag("a", 1), eintrag("b", 2), eintrag("c", 3)]);
    const { senden, gesendet } = sender(async (e) => {
      if (e.id === "a") await queue.leeren(); // Abmelden, während "a" unterwegs ist
      return OK;
    });
    const stand = await verarbeite(queue, senden, () => JETZT);
    expect(gesendet).toEqual(["a"]);
    expect(stand).toEqual({ gesendet: 1, offen: 0, fehlgeschlagen: 0 });
  });
});

describe("verarbeite: Review-Befunde", () => {
  test("ein Fehler ohne Code (abgelehnter fetch aus dem Supabase-SDK) zählt als Netzfehler mit Wartezeit", async () => {
    const queue = imSpeicher([eintrag("a", 1), eintrag("b", 2)]);
    const { senden, gesendet } = sender(() => ({ ok: false, fehler: "" }));
    const stand = await verarbeite(queue, senden, () => JETZT);
    expect(gesendet).toEqual(["a"]); // Netz weg: der Rest bleibt unangetastet
    expect(stand).toEqual({ gesendet: 0, offen: 2, fehlgeschlagen: 0 });
    const a = (await queue.alle()).find((e) => e.id === "a")!;
    expect(a).toMatchObject({ versuche: 1, naechsterVersuchAb: new Date(JETZT + wartezeitMs(1)).toISOString() });
    await verarbeite(queue, senden, () => JETZT + 1000); // innerhalb der Wartezeit: kein neuer Versuch
    expect(gesendet).toEqual(["a"]);
  });

  test("die Wartezeit beginnt beim Fehlschlag, nicht beim Start des Durchgangs", async () => {
    const queue = imSpeicher([eintrag("a", 1)]);
    let zeit = JETZT;
    const { senden } = sender(() => {
      zeit += 60_000; // die Anfrage hängt eine Minute, bevor sie scheitert
      return NETZ;
    });
    await verarbeite(queue, senden, () => zeit);
    const a = (await queue.alle())[0];
    expect(a.naechsterVersuchAb).toBe(new Date(JETZT + 60_000 + wartezeitMs(1)).toISOString());
  });
});
