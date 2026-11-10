import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import {
  filterLink,
  filtereUebungen,
  ilikeMuster,
  kategorieText,
  KATEGORIEN,
  leseFilter,
  muskelText,
  type Filter,
  type Katalogeintrag,
} from "../../../../lib/training/katalog";

// Liest die Sitzung (meine Geräte), nie vorab rendern.
export const dynamic = "force-dynamic";

const LEER = "Keine Übung passt – lockere einen Filter.";

function Auswahl({ titel, filter, feld, optionen }: { titel: string; filter: Filter; feld: "kategorie" | "muskel" | "geraete"; optionen: [string | undefined, string][] }) {
  return (
    <nav aria-label={titel} className="stack">
      <h2>{titel}</h2>
      <div className="chips">
        {optionen.map(([wert, text]) => (
          <Link key={text} href={filterLink(filter, { [feld]: wert })} className="chip" aria-current={filter[feld] === wert ? "true" : undefined}>
            {text}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default async function UebungenPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filter = leseFilter(await searchParams);
  const supabase = await createClient();
  let abfrage = supabase.from("exercises").select("id, name, category, muscle_groups, equipment");
  // Die Eingabe geht als Wert an PostgREST, nie in SQL zusammengesetzt.
  if (filter.suche) abfrage = abfrage.ilike("name", ilikeMuster(filter.suche));
  const { data, error } = await abfrage.order("name");
  if (error || !data) throw new Error("Übungen konnten nicht geladen werden");

  let meineGeraete: string[] = [];
  if (filter.geraete === "meine") {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const profil = await supabase.from("profiles").select("equipment").eq("id", auth.user.id).maybeSingle();
      // Ein Lesefehler ist kein leeres Profil: sonst liefe der Filter still ohne Einschränkung.
      if (profil.error) throw new Error("Geräte konnten nicht geladen werden");
      meineGeraete = (profil.data as { equipment: string[] } | null)?.equipment ?? [];
    }
  }

  const alle = data as Katalogeintrag[];
  const liste = filtereUebungen(alle, { ...filter, meineGeraete });
  const muskeln = [...new Set(alle.flatMap((u) => u.muscle_groups))].sort((a, b) => muskelText(a).localeCompare(muskelText(b), "de"));

  return (
    <main className="page stack" data-narrow>
      <h1>Übungen</h1>
      <form method="get" action="/training/uebungen" className="field" role="search">
        <label htmlFor="suche">Übung suchen</label>
        <input id="suche" name="suche" type="search" className="input" defaultValue={filter.suche ?? ""} autoComplete="off" />
        {(["kategorie", "muskel", "geraete"] as const).map((k) => filter[k] && <input key={k} type="hidden" name={k} value={filter[k]} />)}
      </form>
      <Auswahl titel="Kategorie" filter={filter} feld="kategorie" optionen={[[undefined, "Alle"], ...Object.entries(KATEGORIEN)]} />
      <Auswahl titel="Muskelgruppe" filter={filter} feld="muskel" optionen={[[undefined, "Alle"], ...muskeln.map((m): [string, string] => [m, muskelText(m)])]} />
      <Auswahl
        titel="Geräte"
        filter={filter}
        feld="geraete"
        optionen={[[undefined, "Alle"], ["ohne", "Ohne Geräte"], ["meine", "Passend zu meinen Geräten"]]}
      />
      {liste.length === 0 ? (
        <p className="muted">{LEER}</p>
      ) : (
        <ul className="sets" aria-label="Übungen">
          {liste.map((u) => (
            <li key={u.id}>
              <h2 className="uebung-name">{u.name}</h2>
              <span className="muted">{kategorieText(u.category)}</span>
              <span className="muted">{u.muscle_groups.map(muskelText).join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/training" className="link">
        Zurück
      </Link>
    </main>
  );
}
