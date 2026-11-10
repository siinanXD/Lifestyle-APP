import Link from "next/link";
import { ARTEN, EINWILLIGUNGSTEXTE } from "../../../../lib/consent/texte";
import { createClient } from "../../../../lib/supabase/server";
import { Widerruf } from "./widerruf";

// Liest die Sitzung, nie vorab rendern.
export const dynamic = "force-dynamic";

type Zeile = { kind: string; text_version: string; granted_at: string; revoked_at: string | null };

const datum = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });

export default async function EinwilligungenPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("consents").select("kind, text_version, granted_at, revoked_at");
  // Bei einem Lesefehler nicht „nicht erteilt“ anzeigen: Es fehlt nichts, es klemmt.
  if (error || !data) throw new Error("Einwilligungen konnten nicht geladen werden");
  const offen = (art: string) => (data as Zeile[]).find((z) => z.kind === art && z.revoked_at === null);
  return (
    <main className="page stack" data-narrow>
      <h1>Einwilligungen</h1>
      <p className="muted">Jede Einwilligung ist freiwillig. Du kannst sie hier jederzeit erteilen oder widerrufen.</p>
      {ARTEN.map((art) => {
        const zeile = offen(art);
        return (
          <section key={art} className="card stack" aria-labelledby={`art-${art}`}>
            <h2 id={`art-${art}`}>{EINWILLIGUNGSTEXTE[art].titel}</h2>
            {zeile ? (
              <>
                <p>
                  Erteilt am {datum(zeile.granted_at)} · Textversion {zeile.text_version}
                </p>
                <Widerruf art={art} />
              </>
            ) : (
              <>
                <p>Nicht erteilt</p>
                <Link href={`/einwilligung/${art}?next=${encodeURIComponent("/konto/einwilligungen")}`} className="link">
                  Erteilen
                </Link>
              </>
            )}
          </section>
        );
      })}
      <Link href="/konto" className="link">
        Zurück
      </Link>
    </main>
  );
}
