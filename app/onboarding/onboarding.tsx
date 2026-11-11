"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { erteileEinwilligung } from "../../lib/consent/consent";
import { EINWILLIGUNGSTEXTE } from "../../lib/consent/texte";
import {
  naechster,
  schritte,
  teileFreiwillig,
  vorheriger,
  zusammenfassung,
  zuSpeichern,
  type Antworten,
  type Einwilligungen,
  type Schritt,
} from "../../lib/onboarding/flow";
import { speichereGesundheit, speichereKoerperwerte, speichereProfil } from "../../lib/onboarding/speichern";
import { EINSCHRAENKUNGEN, ERFAHRUNG, FRAGEN, GERAETE, HINWEIS_FREITEXT, MINUTEN, TAGE, ZIELE } from "../../lib/onboarding/texte";
import { createClient } from "../../lib/supabase/client";

const MAX_ZIELE = 3;
const MAX_NOTIZ = 200;
const FEHLER = "Das hat gerade nicht geklappt. Es ist nichts gespeichert. Bitte versuch es gleich noch einmal.";
const HINWEIS_ARZT = "Bei Schmerzen frag bitte ärztlichen Rat; die App stellt keine Diagnosen.";

// Welche Antworten zu welchem Schritt gehören: Weiter speichert genau diese, Überspringen nichts.
const FELDER: Partial<Record<Schritt, (keyof Antworten)[]>> = {
  ziele: ["ziele", "zielNotiz"],
  zeit: ["tageProWoche", "minutenProEinheit"],
  erfahrung: ["erfahrung"],
  einschraenkungen: ["einschraenkungen", "einschraenkungNotiz"],
  geraete: ["geraete"],
  freiwillig: ["gewichtKg", "groesseCm", "gewohnheiten"],
};
const NUR_MIT_B: (keyof Antworten)[] = ["einschraenkungen", "einschraenkungNotiz", "gewichtKg", "groesseCm"];

export type Start = { volljaehrig: boolean; einwilligungA: boolean; einwilligungB: boolean; antworten: Antworten };
type Setze = (teil: Partial<Antworten>) => void;

export function Onboarding({ start }: { start: Start }) {
  const router = useRouter();
  const [volljaehrig, setVolljaehrig] = useState(start.volljaehrig);
  const [haken, setHaken] = useState(false);
  const [zustimmungA, setZustimmungA] = useState(false); // nie vorangekreuzt
  const [zustimmungB, setZustimmungB] = useState(false); // nie vorangekreuzt
  const [einwilligungen, setEinwilligungen] = useState<Einwilligungen>({
    ...(start.einwilligungA && { A: true }),
    ...(start.einwilligungB && { B: true }),
  });
  const [schritt, setSchritt] = useState<Schritt>(start.einwilligungA ? "ziele" : "willkommen");
  const [antworten, setAntworten] = useState<Antworten>(start.antworten);
  // Die Zusammenfassung zeigt nur, was wirklich gespeichert ist.
  const [gespeichert, setGespeichert] = useState<Antworten>(start.antworten);
  const [koerperwerteAn, setKoerperwerteAn] = useState(false);
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  const sichtbar = schritte(einwilligungen);
  const setze: Setze = (teil) => setAntworten((a) => ({ ...a, ...teil }));
  const bFrei = einwilligungen.B === true || zustimmungB;

  function gehe(e: Einwilligungen, nach: "vor" | "zurueck") {
    const ziel = nach === "vor" ? naechster(schritt, e) : vorheriger(schritt, e);
    setFehler("");
    if (ziel === "start") return void beende("/");
    setSchritt(ziel);
  }

  // Abschluss und „Alles überspringen“ setzen nur den Zeitstempel; danach leitet die Startseite nicht mehr hierher.
  async function beende(ziel: string) {
    const ok = await mitBusy(
      async () => !(await speichereProfil(createClient(), { onboarding_completed_at: new Date().toISOString() })).error,
    );
    if (!ok) return;
    router.push(ziel);
    router.refresh();
  }

  async function mitBusy(aktion: () => Promise<boolean>) {
    setBusy(true);
    const ok = await aktion();
    setBusy(false);
    if (!ok) setFehler(FEHLER);
    return ok;
  }

  async function bestaetigeVolljaehrig() {
    const ok = await mitBusy(async () => !(await speichereProfil(createClient(), { adult_confirmed_at: new Date().toISOString() })).error);
    if (ok) setVolljaehrig(true);
  }

  async function willigeEin() {
    if (!zustimmungA) return setFehler("Bitte setze zuerst den Haken, wenn du zustimmen möchtest.");
    if (!(await mitBusy(async () => !(await erteileEinwilligung(createClient(), "A")).error))) return;
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
    let teil = Object.fromEntries((FELDER[schritt] ?? []).map((f) => [f, antworten[f]])) as Antworten;
    if (schritt === "freiwillig" && !koerperwerteAn) teil = { ...teil, gewichtKg: undefined, groesseCm: undefined };
    if (!bFrei) teil = Object.fromEntries(Object.entries(teil).filter(([f]) => !NUR_MIT_B.includes(f as keyof Antworten)));
    // Einwilligung B nur erteilen, wenn wirklich Gesundheitsangaben zu speichern sind (Datenminimierung).
    const mitB = { ...einwilligungen, ...(bFrei && { B: true }) };
    const daten = zuSpeichern(teil, mitB, gespeichert);
    const supabase = createClient();
    const ok = await mitBusy(async () => {
      const brauchtB = Boolean(daten.gesundheit || daten.koerperwerte) && einwilligungen.B !== true;
      if (brauchtB && (await erteileEinwilligung(supabase, "B")).error) return false;
      if (brauchtB) setEinwilligungen(mitB);
      if (daten.profil && (await speichereProfil(supabase, daten.profil)).error) return false;
      if (daten.gesundheit && (await speichereGesundheit(supabase, daten.gesundheit)).error) return false;
      if (daten.koerperwerte && (await speichereKoerperwerte(supabase, daten.koerperwerte)).error) return false;
      return true;
    });
    if (!ok) return;
    setGespeichert((g) => ({ ...g, ...Object.fromEntries(Object.entries(teil).filter(([, v]) => v !== undefined)) }));
    gehe(einwilligungen, "vor");
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
  const allesUeberspringen = (
    <button type="button" className="link-button" onClick={() => beende("/")}>
      Alles überspringen
    </button>
  );

  if (schritt === "willkommen") {
    return (
      <Rahmen titel={FRAGEN.willkommen} fehler={fehler} punkte={punkte}>
        <p>{EINWILLIGUNGSTEXTE.A.text}</p>
        <label className="toggle">
          <input type="checkbox" checked={zustimmungA} onChange={(e) => setZustimmungA(e.target.checked)} />
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
        {allesUeberspringen}
      </Rahmen>
    );
  }

  if (schritt === "zusammenfassung") {
    return (
      <Rahmen titel={FRAGEN.zusammenfassung} fehler={fehler} punkte={punkte}>
        <ul className="summary">
          {zusammenfassung(gespeichert).map(({ label, wert }) => (
            <li key={label}>
              {label}: {wert}
            </li>
          ))}
        </ul>
        <button type="button" className="btn" onClick={() => beende("/training/plan/neu")}>
          Plan erstellen
        </button>
        <button type="button" className="btn" data-variant="neutral" onClick={() => beende("/")}>
          Ohne Plan starten
        </button>
        <button type="button" className="link-button" onClick={() => setSchritt(einwilligungen.A === true ? "ziele" : "willkommen")}>
          Ändern
        </button>
      </Rahmen>
    );
  }

  const zustimmungBFeld =
    einwilligungen.B === true ? null : (
      <div className="card stack">
        <p>{EINWILLIGUNGSTEXTE.B.text}</p>
        <label className="toggle">
          <input type="checkbox" checked={zustimmungB} onChange={(e) => setZustimmungB(e.target.checked)} />
          Ich willige ausdrücklich ein.
        </label>
      </div>
    );

  return (
    <Rahmen titel={FRAGEN[schritt]} fehler={fehler} punkte={punkte}>
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
      {schritt === "einschraenkungen" && (
        <SchrittEinschraenkungen antworten={antworten} setze={setze} frei={bFrei} zustimmung={zustimmungBFeld} />
      )}
      {schritt === "geraete" && (
        <Mehrfach
          legende="Geräte"
          optionen={GERAETE}
          wert={antworten.geraete ?? []}
          exklusiv="keine"
          setze={(geraete) => setze({ geraete })}
        />
      )}
      {schritt === "freiwillig" && (
        <SchrittFreiwillig
          antworten={antworten}
          setze={setze}
          einwilligungen={einwilligungen}
          frei={bFrei}
          zustimmung={zustimmungBFeld}
          koerperwerteAn={koerperwerteAn}
          setKoerperwerteAn={setKoerperwerteAn}
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
        {allesUeberspringen}
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

function Notiz({ id, label, wert, setze, gesperrt }: { id: string; label: string; wert?: string; setze: (v: string) => void; gesperrt?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="input"
        maxLength={MAX_NOTIZ}
        rows={3}
        autoComplete="off"
        disabled={gesperrt}
        aria-describedby={`${id}-hinweis`}
        value={wert ?? ""}
        onChange={(e) => {
          if (e.target.value.length <= MAX_NOTIZ) setze(e.target.value);
        }}
      />
      <p id={`${id}-hinweis`} className="muted">
        {HINWEIS_FREITEXT}
      </p>
    </div>
  );
}

function SchrittZiele({ antworten, setze }: { antworten: Antworten; setze: Setze }) {
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
      <Notiz id="zielNotiz" label="In deinen Worten (optional)" wert={antworten.zielNotiz} setze={(zielNotiz) => setze({ zielNotiz })} />
    </>
  );
}

function SchrittZeit({ antworten, setze }: { antworten: Antworten; setze: Setze }) {
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

function SchrittEinschraenkungen({
  antworten,
  setze,
  frei,
  zustimmung,
}: {
  antworten: Antworten;
  setze: Setze;
  frei: boolean;
  zustimmung: ReactNode;
}) {
  return (
    <>
      <p>Das ist eine freiwillige Gesundheitsangabe.</p>
      {zustimmung}
      <Mehrfach
        legende="Körperbereich"
        optionen={{ ...EINSCHRAENKUNGEN, nein: "Nein / möchte ich nicht sagen" }}
        wert={antworten.einschraenkungen ?? []}
        exklusiv="nein"
        gesperrt={!frei}
        // „Nein“ ist eine Antwort, aber kein Wert: gespeichert wird dann eine leere Auswahl.
        setze={(w) => setze({ einschraenkungen: w.filter((x) => x !== "nein") as Antworten["einschraenkungen"] })}
      />
      <Notiz
        id="einschraenkungNotiz"
        label="Kurztext (optional)"
        wert={antworten.einschraenkungNotiz}
        gesperrt={!frei}
        setze={(einschraenkungNotiz) => setze({ einschraenkungNotiz })}
      />
      <p>{HINWEIS_ARZT}</p>
    </>
  );
}

function SchrittFreiwillig({
  antworten,
  setze,
  einwilligungen,
  frei,
  zustimmung,
  koerperwerteAn,
  setKoerperwerteAn,
}: {
  antworten: Antworten;
  setze: Setze;
  einwilligungen: Einwilligungen;
  frei: boolean;
  zustimmung: ReactNode;
  koerperwerteAn: boolean;
  setKoerperwerteAn: (an: boolean) => void;
}) {
  const teile = teileFreiwillig(einwilligungen);
  const zahl = (v: string) => (v === "" ? undefined : Number(v));
  return (
    <>
      {teile.includes("koerperwerte") && (
        <div className="stack">
          <Schalter name="Körperwerte (Gewicht, Größe)" an={koerperwerteAn} setze={setKoerperwerteAn} />
          {koerperwerteAn && (
            <>
              <p className="muted">Für deine Fortschrittsanzeige. Kein Zielgewicht, kein BMI, keine Bewertung.</p>
              {zustimmung}
              <div className="field">
                <label htmlFor="gewicht">Gewicht (kg)</label>
                <input id="gewicht" className="input" type="number" inputMode="decimal" min={20} max={400} step={0.1} autoComplete="off"
                  disabled={!frei} value={antworten.gewichtKg ?? ""} onChange={(e) => setze({ gewichtKg: zahl(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="groesse">Größe (cm)</label>
                <input id="groesse" className="input" type="number" inputMode="numeric" min={100} max={250} autoComplete="off"
                  disabled={!frei} value={antworten.groesseCm ?? ""} onChange={(e) => setze({ groesseCm: zahl(e.target.value) })} />
              </div>
            </>
          )}
        </div>
      )}
      {teile.includes("gewohnheiten") && (
        <Schalter name="Gewohnheiten (z. B. Wasser, Schlaf)" an={antworten.gewohnheiten === true} setze={(an) => setze({ gewohnheiten: an })} />
      )}
      {/* Einwilligung E wird erst im KI-Epic aktiv (SIN-1316). */}
      <Schalter name="KI-Coach – kommt später" an={false} gesperrt setze={() => {}} />
    </>
  );
}

function Schalter({ name, an, setze, gesperrt }: { name: string; an: boolean; setze: (an: boolean) => void; gesperrt?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={an} className="toggle switch" disabled={gesperrt} onClick={() => setze(!an)}>
      <span className="switch-track" aria-hidden="true" />
      {name}
    </button>
  );
}

function Mehrfach<K extends string>({
  legende,
  optionen,
  wert,
  exklusiv,
  gesperrt,
  setze,
}: {
  legende: string;
  optionen: Record<K, string>;
  wert: string[];
  exklusiv: K;
  gesperrt?: boolean;
  setze: (wert: K[]) => void;
}) {
  // Die exklusive Option („Nein“, „Nichts, nur ich“) schließt alle anderen aus und umgekehrt.
  const [exklusivAn, setExklusivAn] = useState(wert.includes(exklusiv));
  const umschalten = (option: K) => {
    if (option === exklusiv) {
      const an = !exklusivAn;
      setExklusivAn(an);
      return setze(an ? [exklusiv] : []);
    }
    setExklusivAn(false);
    setze((wert.includes(option) ? wert.filter((w) => w !== option) : [...wert.filter((w) => w !== exklusiv), option]) as K[]);
  };
  return (
    <fieldset className="choices">
      <legend>{legende}</legend>
      {(Object.entries(optionen) as [K, string][]).map(([option, text]) => (
        <label key={option} className="toggle">
          <input
            type="checkbox"
            disabled={gesperrt}
            checked={option === exklusiv ? exklusivAn : wert.includes(option)}
            onChange={() => umschalten(option)}
          />
          {text}
        </label>
      ))}
    </fieldset>
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
