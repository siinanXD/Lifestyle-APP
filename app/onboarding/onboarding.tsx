"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { erteileEinwilligung } from "../../lib/consent/consent";
import { EINWILLIGUNGSTEXTE } from "../../lib/consent/texte";
import { naechster, schritte, vorheriger, zuSpeichern, type Antworten, type Einwilligungen, type Schritt } from "../../lib/onboarding/flow";
import { speichereProfil } from "../../lib/onboarding/speichern";
import { ERFAHRUNG, FRAGEN, HINWEIS_FREITEXT, MINUTEN, TAGE, ZIELE } from "../../lib/onboarding/texte";
import { createClient } from "../../lib/supabase/client";

// shortcut: Schritte 4 bis 6 und die Zusammenfassung baut SIN-1264; bis dahin endet das Onboarding nach der Erfahrung auf der Startseite.
const UMGESETZT: Schritt[] = ["willkommen", "ziele", "zeit", "erfahrung"];
const MAX_ZIELE = 3;
const MAX_NOTIZ = 200;
const FEHLER = "Das hat gerade nicht geklappt. Es ist nichts gespeichert. Bitte versuch es gleich noch einmal.";

// Welche Antworten zu welchem Schritt gehören: Weiter speichert genau diese, Überspringen nichts.
const FELDER: Partial<Record<Schritt, (keyof Antworten)[]>> = {
  ziele: ["ziele", "zielNotiz"],
  zeit: ["tageProWoche", "minutenProEinheit"],
  erfahrung: ["erfahrung"],
};

export type Start = { volljaehrig: boolean; einwilligungA: boolean; antworten: Antworten };

export function Onboarding({ start }: { start: Start }) {
  const router = useRouter();
  const [volljaehrig, setVolljaehrig] = useState(start.volljaehrig);
  const [haken, setHaken] = useState(false);
  const [zustimmung, setZustimmung] = useState(false); // Einwilligung A, nie vorangekreuzt
  const [einwilligungen, setEinwilligungen] = useState<Einwilligungen>(start.einwilligungA ? { A: true } : {});
  const [schritt, setSchritt] = useState<Schritt>(start.einwilligungA ? "ziele" : "willkommen");
  const [antworten, setAntworten] = useState<Antworten>(start.antworten);
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  const sichtbar = schritte(einwilligungen).filter((s) => UMGESETZT.includes(s));
  const setze = (teil: Partial<Antworten>) => setAntworten((a) => ({ ...a, ...teil }));

  function gehe(e: Einwilligungen, nach: "vor" | "zurueck") {
    const ziel = nach === "vor" ? naechster(schritt, e) : vorheriger(schritt, e);
    setFehler("");
    if (ziel === "start" || !UMGESETZT.includes(ziel)) {
      router.push("/");
      router.refresh();
      return;
    }
    setSchritt(ziel);
  }

  async function mitBusy(aktion: () => Promise<{ error: unknown }>) {
    setBusy(true);
    const { error } = await aktion();
    setBusy(false);
    if (error) setFehler(FEHLER);
    return !error;
  }

  async function bestaetigeVolljaehrig() {
    if (await mitBusy(() => speichereProfil(createClient(), { adult_confirmed_at: new Date().toISOString() }))) setVolljaehrig(true);
  }

  async function willigeEin() {
    if (!zustimmung) return setFehler("Bitte setze zuerst den Haken, wenn du zustimmen möchtest.");
    if (!(await mitBusy(() => erteileEinwilligung(createClient(), "A")))) return;
    const e = { ...einwilligungen, A: true };
    setEinwilligungen(e);
    gehe(e, "vor");
  }

  function lehneAb() {
    const e = { ...einwilligungen, A: false };
    setEinwilligungen(e);
    gehe(e, "vor");
  }

  async function weiter() {
    const teil = Object.fromEntries((FELDER[schritt] ?? []).map((f) => [f, antworten[f]])) as Antworten;
    const profil = zuSpeichern(teil, einwilligungen).profil;
    if (profil && !(await mitBusy(() => speichereProfil(createClient(), profil)))) return;
    gehe(einwilligungen, "vor");
  }

  function allesUeberspringen() {
    router.push("/");
  }

  if (!volljaehrig) {
    return (
      <Rahmen titel="Bevor es losgeht" fehler={fehler}>
        <p>Die Lifestyle App ist für Erwachsene. Wir speichern nur, dass du es bestätigt hast, kein Geburtsdatum.</p>
        <label className="toggle">
          <input type="checkbox" checked={haken} onChange={(e) => setHaken(e.target.checked)} />
          Ich bin volljährig.
        </label>
        <button type="button" className="btn" disabled={!haken || busy} onClick={bestaetigeVolljaehrig}>
          Weiter
        </button>
      </Rahmen>
    );
  }

  const punkte = <Punkte aktuell={sichtbar.indexOf(schritt) + 1} gesamt={sichtbar.length} />;

  if (schritt === "willkommen") {
    return (
      <Rahmen titel={FRAGEN.willkommen} fehler={fehler} punkte={punkte}>
        <p>{EINWILLIGUNGSTEXTE.A.text}</p>
        <label className="toggle">
          <input type="checkbox" checked={zustimmung} onChange={(e) => setZustimmung(e.target.checked)} />
          Ich stimme zu.
        </label>
        <div className="actions">
          <button type="button" className="btn" disabled={busy} onClick={willigeEin}>
            Los geht&apos;s
          </button>
          <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={lehneAb}>
            Überspringen
          </button>
        </div>
        <button type="button" className="link-button" onClick={allesUeberspringen}>
          Alles überspringen
        </button>
      </Rahmen>
    );
  }

  return (
    <Rahmen titel={FRAGEN[schritt as "ziele" | "zeit" | "erfahrung"]} fehler={fehler} punkte={punkte}>
      {schritt === "ziele" && <SchrittZiele antworten={antworten} setze={setze} />}
      {schritt === "zeit" && <SchrittZeit antworten={antworten} setze={setze} />}
      {schritt === "erfahrung" && (
        <Auswahl
          name="erfahrung"
          legende="Erfahrung"
          optionen={Object.entries(ERFAHRUNG) as [keyof typeof ERFAHRUNG, string][]}
          wert={antworten.erfahrung}
          setze={(erfahrung) => setze({ erfahrung })}
        />
      )}
      <div className="actions">
        <button type="button" className="btn" disabled={busy} onClick={weiter}>
          Weiter
        </button>
        <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => gehe(einwilligungen, "vor")}>
          Überspringen
        </button>
      </div>
      <div className="actions-row">
        <button type="button" className="link-button" disabled={busy} onClick={() => gehe(einwilligungen, "zurueck")}>
          Zurück
        </button>
        <button type="button" className="link-button" onClick={allesUeberspringen}>
          Alles überspringen
        </button>
      </div>
    </Rahmen>
  );
}

function Rahmen({ titel, fehler, punkte, children }: { titel: string; fehler: string; punkte?: ReactNode; children: ReactNode }) {
  return (
    <main className="page stack" data-narrow>
      {punkte}
      <h1>{titel}</h1>
      {children}
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}
    </main>
  );
}

function Punkte({ aktuell, gesamt }: { aktuell: number; gesamt: number }) {
  return (
    <ol className="dots" aria-label={`Schritt ${aktuell} von ${gesamt}`}>
      {Array.from({ length: gesamt }, (_, i) => (
        <li key={i} data-aktiv={i < aktuell ? "" : undefined} />
      ))}
    </ol>
  );
}

function SchrittZiele({ antworten, setze }: { antworten: Antworten; setze: (t: Partial<Antworten>) => void }) {
  const gewaehlt = antworten.ziele ?? [];
  const umschalten = (ziel: keyof typeof ZIELE) =>
    setze({ ziele: gewaehlt.includes(ziel) ? gewaehlt.filter((z) => z !== ziel) : [...gewaehlt, ziel].slice(0, MAX_ZIELE) });
  return (
    <>
      <p className="muted">Bis zu {MAX_ZIELE} auswählen.</p>
      <div className="chips">
        {(Object.entries(ZIELE) as [keyof typeof ZIELE, string][]).map(([ziel, text]) => {
          const an = gewaehlt.includes(ziel);
          return (
            <button
              key={ziel}
              type="button"
              className="chip"
              aria-pressed={an}
              disabled={!an && gewaehlt.length >= MAX_ZIELE}
              onClick={() => umschalten(ziel)}
            >
              {text}
            </button>
          );
        })}
      </div>
      <div className="field">
        <label htmlFor="zielNotiz">In deinen Worten (optional)</label>
        <textarea
          id="zielNotiz"
          className="input"
          maxLength={MAX_NOTIZ}
          rows={3}
          aria-describedby="zielNotiz-hinweis"
          value={antworten.zielNotiz ?? ""}
          onChange={(e) => {
            if (e.target.value.length <= MAX_NOTIZ) setze({ zielNotiz: e.target.value });
          }}
        />
        <p id="zielNotiz-hinweis" className="muted">
          {HINWEIS_FREITEXT}
        </p>
      </div>
    </>
  );
}

function SchrittZeit({ antworten, setze }: { antworten: Antworten; setze: (t: Partial<Antworten>) => void }) {
  return (
    <>
      {/* „Mal so, mal so“ hat keinen DB-Wert (Check 1–6, SIN-1257): dann die Frage überspringen. */}
      <Auswahl
        name="tage"
        legende="Tage pro Woche"
        optionen={TAGE.map((t) => [t, String(t)] as [number, string])}
        wert={antworten.tageProWoche}
        setze={(tageProWoche) => setze({ tageProWoche })}
      />
      <Auswahl
        name="minuten"
        legende="Minuten pro Einheit"
        optionen={MINUTEN.map((m) => [m, `${m} Min`] as [(typeof MINUTEN)[number], string])}
        wert={antworten.minutenProEinheit}
        setze={(minutenProEinheit) => setze({ minutenProEinheit })}
      />
    </>
  );
}

function Auswahl<T extends string | number>({
  name,
  legende,
  optionen,
  wert,
  setze,
}: {
  name: string;
  legende: string;
  optionen: [T, string][];
  wert: T | undefined;
  setze: (wert: T) => void;
}) {
  return (
    <fieldset className="choices">
      <legend>{legende}</legend>
      {optionen.map(([option, text]) => (
        <label key={String(option)} className="toggle">
          <input type="radio" name={name} checked={wert === option} onChange={() => setze(option)} />
          {text}
        </label>
      ))}
    </fieldset>
  );
}
