import Link from "next/link";
import { notFound } from "next/navigation";
import { KUECHENGERAETE } from "../../../../../lib/kochen/geraete";
import { EINHEITEN, ladeGeraete, ladeVorrat } from "../../../../../lib/kochen/kueche";
import { FILTER, findeRezept, kennzeichen, schlageVor, type Rezeptzutat } from "../../../../../lib/kochen/rezepte";
import { istGrundzutat, zutatName } from "../../../../../lib/kochen/zutaten";
import { createClient } from "../../../../../lib/supabase/server";
import { AufListe } from "./auf-liste";

// Liest Vorrat und Geräte der angemeldeten Person, um Fehlendes zu zeigen; nie vorab rendern.
export const dynamic = "force-dynamic";

const NAEHRWERT_HINWEIS = "Nährwerte sind grobe Schätzungen je Portion und kein Ersatz für ärztliche oder ernährungsberatende Beratung.";
const menge = (z: Rezeptzutat) => (z.menge === undefined ? "" : `${z.menge.toLocaleString("de-DE")}${z.einheit ? ` ${EINHEITEN[z.einheit]}` : ""} `);

export default async function RezeptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rezept = findeRezept(slug);
  if (!rezept) notFound();
  const supabase = await createClient();
  const [vorrat, geraete] = await Promise.all([ladeVorrat(supabase as never), ladeGeraete(supabase as never)]);
  if (!vorrat.ok || !geraete.ok) throw new Error("Vorrat und Geräte konnten nicht geladen werden");
  const da = new Set((vorrat.daten ?? []).flatMap((z) => (z.ingredient_key ? [z.ingredient_key] : [])));
  const kueche = new Set((geraete.daten ?? []).map((g) => g.kind as string));
  // Fehlendes unabhängig von den Geräten bestimmen: Die Seite soll auch zeigen, wenn nur ein Gerät fehlt.
  const fehlend = schlageVor([{ ...rezept, geraete: [] }], da, [])[0].fehlend;
  const fehlendeGeraete = rezept.geraete.filter((g) => !kueche.has(g));

  return (
    <main className="page stack" data-narrow>
      <p className="eyebrow">{[`${rezept.minuten} Min`, `${rezept.portionen} ${rezept.portionen === 1 ? "Portion" : "Portionen"}`, ...kennzeichen(rezept).map((k) => FILTER[k])].join(" · ")}</p>
      <h1>{rezept.name}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- schon verkleinerte Datei; die Bildoptimierung von Vercel ist kontingentiert */}
      {rezept.bild && <img src={rezept.bild} alt={`Foto: ${rezept.name}`} className="rezept-bild" />}
      {rezept.geraete.length > 0 && <p className="muted">Du brauchst: {rezept.geraete.map((g) => KUECHENGERAETE[g]).join(", ")}</p>}
      {fehlendeGeraete.length > 0 && <p role="note">Dieses Gerät ist bei dir nicht eingetragen: {fehlendeGeraete.map((g) => KUECHENGERAETE[g]).join(", ")}</p>}

      <section className="card stack" aria-label="Zutaten">
        <h2>Zutaten</h2>
        <ul className="summary">
          {rezept.zutaten.map((z) => (
            <li key={z.key}>
              {menge(z)}
              {zutatName(z.key)}
              {z.optional ? " (freiwillig)" : ""}
              {!z.optional && !istGrundzutat(z.key) && (fehlend.includes(z.key) ? " – fehlt" : " – da")}
            </li>
          ))}
        </ul>
        <p className="muted">Salz, Pfeffer, Öl und Wasser setzt die App voraus.</p>
        {fehlend.length > 0 ? <p>Es fehlt: {fehlend.map(zutatName).join(", ")}</p> : <p>Alles da.</p>}
        <AufListe slug={rezept.slug} fehlend={fehlend} />
      </section>

      <section className="stack" aria-label="Zubereitung">
        <h2>Zubereitung</h2>
        <ol className="stack">
          {rezept.schritte.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <p>
        Je Portion etwa {rezept.kcal} kcal und {rezept.protein_g} g Eiweiß.
      </p>
      <p className="muted">{NAEHRWERT_HINWEIS}</p>
      {rezept.quelle === "based.cooking" && <p className="muted">Rezept und Foto nach based.cooking (gemeinfrei), übersetzt und angepasst.</p>}
      <Link href="/kochen" className="link">
        Zu den Vorschlägen
      </Link>
    </main>
  );
}
