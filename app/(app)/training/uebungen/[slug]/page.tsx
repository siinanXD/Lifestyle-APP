import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";
import { geraetText, kategorieText, muskelText, varianten } from "../../../../../lib/training/katalog";

// Liest mit der Sitzung (Katalog ist nur für Angemeldete lesbar), nie vorab rendern.
export const dynamic = "force-dynamic";

const HINWEIS = "Bei Schmerzen frag bitte ärztlichen Rat; die App stellt keine Diagnosen.";

type Uebung = {
  slug: string;
  name: string;
  category: string;
  muscle_groups: string[];
  equipment: string[];
  technique: string;
  variant_of: string | null;
};
type Kurz = { slug: string; name: string; variant_of: string | null };

function Variantenliste({ titel, liste }: { titel: string; liste: Kurz[] }) {
  if (liste.length === 0) return null;
  return (
    <>
      <h3>{titel}</h3>
      <ul className="summary">
        {liste.map((u) => (
          <li key={u.slug}>
            <Link href={`/training/uebungen/${u.slug}`} className="link">
              {u.name}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function UebungPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const [uebung, alle] = await Promise.all([
    supabase.from("exercises").select("slug, name, category, muscle_groups, equipment, technique, variant_of").eq("slug", slug).maybeSingle(),
    supabase.from("exercises").select("slug, name, variant_of").order("name"),
  ]);
  if (uebung.error || alle.error) throw new Error("Übung konnte nicht geladen werden");
  if (!uebung.data) notFound();
  const u = uebung.data as Uebung;
  const { leichter, schwerer } = varianten(u, (alle.data ?? []) as Kurz[]);
  return (
    <main className="page stack" data-narrow>
      <p className="eyebrow">{kategorieText(u.category)}</p>
      <h1>{u.name}</h1>
      <dl className="stack">
        <div>
          <dt className="muted">Muskelgruppen</dt>
          <dd>{u.muscle_groups.length > 0 ? u.muscle_groups.map(muskelText).join(", ") : "nicht angegeben"}</dd>
        </div>
        <div>
          <dt className="muted">Geräte</dt>
          <dd>{u.equipment.length > 0 ? u.equipment.map(geraetText).join(", ") : "Ohne Geräte"}</dd>
        </div>
      </dl>
      <section className="card stack">
        <h2>Technik</h2>
        <p>{u.technique}</p>
      </section>
      {(leichter.length > 0 || schwerer.length > 0) && (
        <section className="stack" aria-label="Varianten">
          <h2>Varianten</h2>
          <Variantenliste titel="Leichter" liste={leichter} />
          <Variantenliste titel="Schwerer" liste={schwerer} />
        </section>
      )}
      <p className="muted">{HINWEIS}</p>
      <Link href="/training/uebungen" className="link">
        Zur Übungsbibliothek
      </Link>
    </main>
  );
}
