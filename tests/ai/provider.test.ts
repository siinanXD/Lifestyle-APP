import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { erzeugeFakeAnbieter } from "../../lib/ai/fake";
import { holeAnbieter } from "../../lib/ai/index";
import { absichern, MAX_AUSGABE_TOKENS, ZEITLIMIT_MS, type LlmAnfrage, type LlmErgebnis } from "../../lib/ai/provider";

const ANFRAGE = { system: "Du erklärst Trainingspläne.", nutzer: "Ziel: Ausdauer, Erfahrung: Anfänger" };
const ERFOLG: LlmErgebnis = { ok: true, text: "ok", tokensEin: 1, tokensAus: 1, modell: "test" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("holeAnbieter", () => {
  test.each([undefined, "", "off", "true", "ON"])("AI_ENABLED=%s → aus, der Fake wird nie aufgerufen", async (wert) => {
    if (wert !== undefined) vi.stubEnv("AI_ENABLED", wert);
    vi.stubEnv("LLM_PROVIDER", "fake");
    const fake = vi.fn(erzeugeFakeAnbieter);

    expect(await holeAnbieter(fake).generiere(ANFRAGE)).toEqual({ ok: false, grund: "aus" });
    expect(fake).not.toHaveBeenCalled();
  });

  test("AI_ENABLED=on und LLM_PROVIDER=fake → Fake antwortet mit LLM_MODEL", async () => {
    vi.stubEnv("AI_ENABLED", "on");
    vi.stubEnv("LLM_PROVIDER", "fake");
    vi.stubEnv("LLM_MODEL", "fake-klein");

    expect(await holeAnbieter().generiere(ANFRAGE)).toMatchObject({ ok: true, modell: "fake-klein" });
  });

  test.each([undefined, "anthropic", "unbekannt"])("AI_ENABLED=on, LLM_PROVIDER=%s → aus (noch kein Adapter)", async (wert) => {
    vi.stubEnv("AI_ENABLED", "on");
    if (wert !== undefined) vi.stubEnv("LLM_PROVIDER", wert);

    expect(await holeAnbieter().generiere(ANFRAGE)).toEqual({ ok: false, grund: "aus" });
  });
});

describe("Fake-Anbieter", () => {
  test("ist deterministisch", async () => {
    const fake = erzeugeFakeAnbieter({ text: "Erklärung" });
    const erstes = await fake.generiere(ANFRAGE);

    expect(erstes).toEqual({ ok: true, text: "Erklärung", tokensEin: 16, tokensAus: 3, modell: "fake" });
    expect(await fake.generiere(ANFRAGE)).toEqual(erstes);
  });

  test.each(["quote", "dienstfehler", "ungueltig"] as const)("gemeldeter Fehler %s → ok: false", async (grund) => {
    expect(await erzeugeFakeAnbieter({ fehler: grund }).generiere(ANFRAGE)).toEqual({ ok: false, grund });
  });

  test("geworfener Fehler → dienstfehler statt Exception", async () => {
    const fake = erzeugeFakeAnbieter({ fehler: new Error("Netz weg") });

    await expect(fake.generiere(ANFRAGE)).resolves.toEqual({ ok: false, grund: "dienstfehler" });
  });

  test("Zeitüberschreitung → zeitlimit statt Exception", async () => {
    vi.useFakeTimers();
    const ergebnis = erzeugeFakeAnbieter({ verzoegerungMs: 500 }).generiere({ ...ANFRAGE, zeitlimitMs: 100 });
    await vi.advanceTimersByTimeAsync(100);

    await expect(ergebnis).resolves.toEqual({ ok: false, grund: "zeitlimit" });
  });

  test("Verzögerung unter dem Zeitlimit → Antwort", async () => {
    vi.useFakeTimers();
    const ergebnis = erzeugeFakeAnbieter({ verzoegerungMs: 50 }).generiere({ ...ANFRAGE, zeitlimitMs: 100 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(ergebnis).resolves.toMatchObject({ ok: true });
  });

  test("signal bricht ab", async () => {
    vi.useFakeTimers();
    const abbruch = new AbortController();
    const ergebnis = erzeugeFakeAnbieter({ verzoegerungMs: 500 }).generiere({ ...ANFRAGE, signal: abbruch.signal });
    abbruch.abort();

    await expect(ergebnis).resolves.toEqual({ ok: false, grund: "zeitlimit" });
  });
});

describe("absichern", () => {
  const roh = (antwort: Promise<LlmErgebnis> = Promise.resolve(ERFOLG)) => vi.fn((anfrage: LlmAnfrage) => (void anfrage, antwort));
  const empfangen = (anbieter: ReturnType<typeof roh>) => anbieter.mock.calls[0][0];

  test("maxAusgabeTokens: 5000 wird auf 600 begrenzt", async () => {
    const generiere = roh();
    await absichern({ generiere }).generiere({ ...ANFRAGE, maxAusgabeTokens: 5000 });

    expect(MAX_AUSGABE_TOKENS).toBe(600);
    expect(empfangen(generiere).maxAusgabeTokens).toBe(600);
  });

  test.each([
    [undefined, 600],
    [0, 600],
    [-5, 600],
    [Number.NaN, 600],
    [200, 200],
  ])("maxAusgabeTokens %s → %s", async (angefragt, erwartet) => {
    const generiere = roh();
    await absichern({ generiere }).generiere({ ...ANFRAGE, maxAusgabeTokens: angefragt });

    expect(empfangen(generiere).maxAusgabeTokens).toBe(erwartet);
  });

  test.each([
    [undefined, 20_000],
    [60_000, 20_000],
    [5_000, 5_000],
  ])("zeitlimitMs %s → %s", async (angefragt, erwartet) => {
    const generiere = roh();
    await absichern({ generiere }).generiere({ ...ANFRAGE, zeitlimitMs: angefragt });

    expect(ZEITLIMIT_MS).toBe(20_000);
    expect(empfangen(generiere).zeitlimitMs).toBe(erwartet);
  });

  test("bereits abgebrochenes signal → der Anbieter wird nicht aufgerufen", async () => {
    const generiere = roh();
    const ergebnis = await absichern({ generiere }).generiere({ ...ANFRAGE, signal: AbortSignal.abort() });

    expect(ergebnis).toEqual({ ok: false, grund: "zeitlimit" });
    expect(generiere).not.toHaveBeenCalled();
  });

  test("der Anbieter bekommt ein signal, das bei Abbruch und Zeitlimit auslöst", async () => {
    vi.useFakeTimers();
    const generiere = roh(new Promise(() => {}));
    const ergebnis = absichern({ generiere }).generiere({ ...ANFRAGE, zeitlimitMs: 100 });
    const signal = empfangen(generiere).signal;

    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(signal?.aborted).toBe(true);
    await expect(ergebnis).resolves.toEqual({ ok: false, grund: "zeitlimit" });
  });

  test("synchron geworfener Fehler → dienstfehler", async () => {
    const anbieter = absichern({
      generiere: () => {
        throw new Error("kaputt");
      },
    });

    await expect(anbieter.generiere(ANFRAGE)).resolves.toEqual({ ok: false, grund: "dienstfehler" });
  });

  test("schreibt weder Prompt noch Antwort noch Fehlertext in die Konsole", async () => {
    const methoden = ["log", "info", "warn", "error", "debug"] as const;
    const spione = methoden.map((methode) => vi.spyOn(console, methode).mockImplementation(() => {}));

    await erzeugeFakeAnbieter({ text: "CANARY-GESUNDHEIT" }).generiere({ system: "CANARY-GESUNDHEIT", nutzer: "CANARY-GESUNDHEIT" });
    await erzeugeFakeAnbieter({ fehler: new Error("CANARY-GESUNDHEIT") }).generiere(ANFRAGE);

    for (const spion of spione) expect(spion).not.toHaveBeenCalled();
  });
});

describe("Schlüssel", () => {
  // Typische Präfixe von Modell-API-Schlüsseln (Anthropic, OpenAI, Google, Groq, xAI).
  const SCHLUESSEL = /\bsk-ant-[\w-]{8,}|\bsk-(proj-)?[A-Za-z0-9]{20,}|\bAIza[\w-]{30,}|\bgsk_[A-Za-z0-9]{20,}|\bxai-[A-Za-z0-9]{20,}/;

  test("das Muster erkennt Schlüssel", () => {
    expect(SCHLUESSEL.test(`const k = "${"sk-" + "ant-"}api03-erfunden123";`)).toBe(true);
    expect(SCHLUESSEL.test("process.env.LLM_API_KEY")).toBe(false);
  });

  test("Quelltext enthält keine fest eingetragenen Schlüssel", () => {
    const dateien = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" })
      .split("\0")
      .filter((pfad) => /\.(ts|tsx|mts|mjs|js|json|md|sql|toml|yml|yaml|example)$/.test(pfad));
    const treffer = dateien.filter((pfad) => {
      try {
        return SCHLUESSEL.test(readFileSync(pfad, "utf8"));
      } catch {
        return false; // im Index, aber im Arbeitsverzeichnis gelöscht
      }
    });

    expect(dateien).toContain("lib/ai/provider.ts");
    expect(treffer).toEqual([]);
  });

  test(".env.example nennt die KI-Variablen ohne Werte", () => {
    const zeilen = readFileSync(".env.example", "utf8").split(/\r?\n/);

    for (const name of ["AI_ENABLED", "LLM_PROVIDER", "LLM_MODEL", "LLM_API_KEY"]) expect(zeilen).toContain(`${name}=`);
  });
});
