"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { amTag, FEHLERTEXTE, gleicherTag, HINWEIS, pruefeMahlzeit, summe, TAGE_LADEN, zuletztGegessen, type Mahlzeit } from "../../../lib/essen/mahlzeiten";
import { reiheEin } from "../../../lib/offline/sync";

const LEER = { name: "", menge: "", kcal: "", eiweiss: "", kohlenhydrate: "", fett: "", uhrzeit: "" };
const zahl = (wert: number | null) => (wert === null ? "" : String(Number(wert)).replace(".", ","));
const g = (wert: number) => `${Number(wert).toLocaleString("de-DE")} g`;
const uhr = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const tagText = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
const verschiebe = (d: Date, tage: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + tage);
const naehrwerte = (m: Pick<Mahlzeit, "kcal" | "protein_g" | "carbs_g" | "fat_g">) =>
  [m.kcal !== null && `${m.kcal} kcal`, m.protein_g !== null && `Eiweiß ${g(m.protein_g)}`, m.carbs_g !== null && `Kohlenhydrate ${g(m.carbs_g)}`, m.fat_g !== null && `Fett ${g(m.fat_g)}`]
    .filter(Boolean)
    .join(" · ");

// Tage hängen an der Zeitzone des Geräts: erst im Browser rechnen (wie beim Wasser).
const leer = () => () => {};
const useImBrowser = () => useSyncExternalStore(leer, () => true, () => false);

export function Mahlzeiten({ start }: { start: Mahlzeit[] }) {
  const imBrowser = useImBrowser();
  const [liste, setListe] = useState(start);
  const [tag, setTag] = useState(() => new Date());
  const [form, setForm] = useState(LEER);
  const [bearbeite, setBearbeite] = useState<string | null>(null); // id der Mahlzeit in Bearbeitung
  const [fehler, setFehler] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const heute = new Date();
  const istHeute = gleicherTag(tag, heute);
  const amAnfang = gleicherTag(tag, verschiebe(heute, -TAGE_LADEN));
  const desTages = imBrowser ? amTag(liste, tag) : [];
  const s = summe(desTages);
  const feld = (name: keyof typeof LEER) => ({ value: form[name], onChange: (e: { target: { value: string } }) => setForm({ ...form, [name]: e.target.value }) });

  function abbrechen() {
    setBearbeite(null);
    setForm(LEER);
    setFehler([]);
  }

  async function speichern() {
    // Zeit: gewählter Tag plus Uhrzeit aus dem Feld, sonst jetzt.
    const [h, min] = (form.uhrzeit || uhr(new Date())).split(":").map(Number);
    const zeit = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), h, min);
    const pruefung = pruefeMahlzeit({ ...form, zeit });
    if (!pruefung.ok) return setFehler(pruefung.fehler.map((f) => FEHLERTEXTE[f]));
    const id = bearbeite ?? crypto.randomUUID();
    setBusy(true);
    try {
      // Zuerst in die Warteschlange (SIN-1287), sofort anzeigen; gesendet wird danach, auch nach einer Offline-Zeit.
      await reiheEin("mahlzeit", { id, ...pruefung.werte });
    } catch {
      setBusy(false);
      return setFehler(["Das hat gerade nicht geklappt. Der Eintrag ist nicht gespeichert. Bitte versuch es gleich noch einmal."]);
    }
    setBusy(false);
    setListe((alt) => [{ id, ...pruefung.werte }, ...alt.filter((m) => m.id !== id)]);
    abbrechen();
  }

  async function loeschen(id: string) {
    setBusy(true);
    try {
      await reiheEin("mahlzeit_loeschen", { id });
    } catch {
      setBusy(false);
      return setFehler(["Das hat gerade nicht geklappt. Der Eintrag ist noch da."]);
    }
    setBusy(false);
    setListe((alt) => alt.filter((m) => m.id !== id));
    if (bearbeite === id) abbrechen();
  }

  function aendere(m: Mahlzeit) {
    setFehler([]);
    setBearbeite(m.id);
    setForm({ name: m.name, menge: m.amount_note ?? "", kcal: zahl(m.kcal), eiweiss: zahl(m.protein_g), kohlenhydrate: zahl(m.carbs_g), fett: zahl(m.fat_g), uhrzeit: uhr(new Date(m.eaten_at)) });
  }

  const nimm = (m: Mahlzeit) =>
    setForm({ ...form, name: m.name, menge: m.amount_note ?? "", kcal: zahl(m.kcal), eiweiss: zahl(m.protein_g), kohlenhydrate: zahl(m.carbs_g), fett: zahl(m.fat_g) });

  return (
    <main className="page stack" data-narrow>
      <h1>Essen</h1>
      <div className="actions-row" role="group" aria-label="Tag wählen">
        <button type="button" className="btn" data-variant="neutral" disabled={amAnfang} onClick={() => setTag(verschiebe(tag, -1))}>
          Zurück
        </button>
        <button type="button" className="btn" data-variant="neutral" disabled={istHeute} onClick={() => setTag(verschiebe(tag, 1))}>
          Vor
        </button>
      </div>
      <section className="stack" aria-labelledby="tag">
        <h2 id="tag">{imBrowser ? (istHeute ? "Heute" : tagText(tag)) : "…"}</h2>
        {imBrowser && desTages.length === 0 ? (
          <p className="muted">Für diesen Tag ist nichts eingetragen.</p>
        ) : (
          <ul className="sets" aria-label="Mahlzeiten">
            {desTages.map((m) => (
              <li key={m.id}>
                <span>
                  {m.name}
                  {m.amount_note ? ` (${m.amount_note})` : ""}
                </span>
                <span className="actions-row">
                  <button type="button" className="link-button" disabled={busy} aria-label={`${m.name} ändern`} onClick={() => aendere(m)}>
                    Ändern
                  </button>
                  <button type="button" className="link-button" disabled={busy} aria-label={`${m.name} löschen`} onClick={() => loeschen(m.id)}>
                    Löschen
                  </button>
                </span>
                <span className="muted">{[`${uhr(new Date(m.eaten_at))} Uhr`, naehrwerte(m)].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
        {desTages.length > 0 && (
          <p data-testid="summe">{naehrwerte(s) ? `Summe der Angaben: ${naehrwerte(s)}` : "Für diesen Tag gibt es keine Nährwert-Angaben."}</p>
        )}
      </section>

      <section className="card stack" aria-labelledby="formular">
        <h2 id="formular">{bearbeite ? "Mahlzeit ändern" : "Mahlzeit hinzufügen"}</h2>
        {!bearbeite && zuletztGegessen(liste).length > 0 && (
          <div className="stack" role="group" aria-label="Zuletzt gegessen">
            <p className="muted">Zuletzt gegessen</p>
            <div className="chips">
              {zuletztGegessen(liste).map((m) => (
                <button key={m.id} type="button" className="chip" onClick={() => nimm(m)}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="name">Was hast du gegessen?</label>
          <input id="name" className="input" maxLength={100} autoComplete="off" {...feld("name")} />
        </div>
        <div className="field">
          <label htmlFor="menge">Menge (freiwillig)</label>
          <input id="menge" className="input" maxLength={60} autoComplete="off" placeholder="z. B. 1 Portion" {...feld("menge")} />
        </div>
        <div className="field">
          <label htmlFor="uhrzeit">Uhrzeit</label>
          <input id="uhrzeit" className="input" type="time" {...feld("uhrzeit")} aria-describedby="uhrzeit-hinweis" />
          <p id="uhrzeit-hinweis" className="muted">Leer lassen für jetzt.</p>
        </div>
        <div className="field">
          <label htmlFor="kcal">Kalorien in kcal (freiwillig)</label>
          <input id="kcal" className="input" inputMode="numeric" autoComplete="off" {...feld("kcal")} />
        </div>
        <div className="field">
          <label htmlFor="eiweiss">Eiweiß in g (freiwillig)</label>
          <input id="eiweiss" className="input" inputMode="decimal" autoComplete="off" {...feld("eiweiss")} />
        </div>
        <div className="field">
          <label htmlFor="kohlenhydrate">Kohlenhydrate in g (freiwillig)</label>
          <input id="kohlenhydrate" className="input" inputMode="decimal" autoComplete="off" {...feld("kohlenhydrate")} />
        </div>
        <div className="field">
          <label htmlFor="fett">Fett in g (freiwillig)</label>
          <input id="fett" className="input" inputMode="decimal" autoComplete="off" {...feld("fett")} />
        </div>
        <button type="button" className="btn" disabled={busy} onClick={speichern}>
          {bearbeite ? "Änderung speichern" : "Hinzufügen"}
        </button>
        {bearbeite && (
          <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={abbrechen}>
            Abbrechen
          </button>
        )}
        {fehler.length > 0 && (
          <div role="alert" className="error">
            {fehler.map((f) => (
              <p key={f}>{f}</p>
            ))}
          </div>
        )}
        <p className="muted">{HINWEIS}</p>
      </section>

      <nav className="stack" aria-label="Mehr erfassen">
        <h2>Mehr erfassen</h2>
        <Link href="/essen/wasser" className="link">
          Wasser
        </Link>
      </nav>
    </main>
  );
}
