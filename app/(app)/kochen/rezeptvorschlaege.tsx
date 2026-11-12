"use client";

import Link from "next/link";
import { useState } from "react";
import { FILTER, kennzeichen, REZEPTE, schlageVor, WENIG_FEHLT_BIS, type Filter, type Vorschlag } from "../../../lib/kochen/rezepte";
import { zutatName } from "../../../lib/kochen/zutaten";

function Karte({ v }: { v: Vorschlag }) {
  const r = v.rezept;
  return (
    <li>
      <Link href={`/kochen/rezept/${r.slug}`} className="link">
        {r.name}
      </Link>
      {/* Schmuckbild: Der Name steht daneben, deshalb leerer Alternativtext. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- kleine, schon verkleinerte Datei; die Bildoptimierung von Vercel ist kontingentiert */}
      {r.bild ? <img src={r.bild} alt="" className="rezept-klein" loading="lazy" width={72} height={72} /> : <span />}
      <span className="muted">
        {[`${r.minuten} Min`, ...kennzeichen(r).map((k) => FILTER[k])].join(" · ")}
      </span>
      {v.fehlend.length > 0 && <span>Es fehlt: {v.fehlend.map(zutatName).join(", ")}</span>}
    </li>
  );
}

export function Rezeptvorschlaege({ vorrat, geraete }: { vorrat: string[]; geraete: string[] }) {
  const [filter, setFilter] = useState<Filter[]>([]);
  const alle = schlageVor(REZEPTE, vorrat, geraete, filter);
  const allesDa = alle.filter((v) => v.fehlend.length === 0);
  const wenig = alle.filter((v) => v.fehlend.length > 0 && v.fehlend.length <= WENIG_FEHLT_BIS);
  const rest = alle.length - allesDa.length - wenig.length;
  const umschalten = (f: Filter) => setFilter(filter.includes(f) ? filter.filter((x) => x !== f) : [...filter, f]);

  return (
    <main className="page stack" data-narrow>
      <h1>Kochen</h1>
      <nav className="chips" aria-label="Küche">
        <Link href="/kochen/vorrat" className="chip">
          Mein Vorrat
        </Link>
        <Link href="/kochen/geraete" className="chip">
          Küchengeräte
        </Link>
        <Link href="/kochen/einkauf" className="chip">
          Einkaufsliste
        </Link>
      </nav>
      {geraete.length === 0 && (
        <p className="muted">
          Du hast noch keine Küchengeräte eingetragen. Solange zeigt die App nur Rezepte, die ohne Gerät gehen.
        </p>
      )}
      {vorrat.length === 0 && <p className="muted">Dein Vorrat ist noch leer. Trag ein, was du da hast, dann passen die Vorschläge besser.</p>}

      <div className="chips" role="group" aria-label="Filter">
        {(Object.entries(FILTER) as [Filter, string][]).map(([f, text]) => (
          <button key={f} type="button" className="chip" aria-pressed={filter.includes(f)} onClick={() => umschalten(f)}>
            {text}
          </button>
        ))}
      </div>

      <section className="stack" aria-label="Alles da">
        <h2>Alles da</h2>
        {allesDa.length === 0 ? (
          <p className="muted">Dafür ist gerade kein Rezept vollständig da.</p>
        ) : (
          <ul className="sets">
            {allesDa.map((v) => (
              <Karte key={v.rezept.slug} v={v} />
            ))}
          </ul>
        )}
      </section>

      <section className="stack" aria-label="Es fehlt wenig">
        <h2>Es fehlt wenig</h2>
        {wenig.length === 0 ? (
          <p className="muted">Kein Rezept, bei dem nur ein paar Zutaten fehlen.</p>
        ) : (
          <ul className="sets">
            {wenig.map((v) => (
              <Karte key={v.rezept.slug} v={v} />
            ))}
          </ul>
        )}
      </section>

      {rest > 0 && (
        <p className="muted">
          {rest === 1 ? "1 weiteres Rezept braucht" : `${rest} weitere Rezepte brauchen`} mehr als {WENIG_FEHLT_BIS} Zutaten, die nicht da sind.
        </p>
      )}
      <Link href="/essen" className="link">
        Zurück
      </Link>
    </main>
  );
}
