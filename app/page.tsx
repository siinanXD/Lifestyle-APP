import { createClient } from "../lib/supabase/server";
import { GLAS_ML, ZIEL_GLAESER, glaeser, wasserProTag, type WasserZeile } from "../lib/wasser";

// Kartenwerte aus Figma „08 Startseite“ (Wasser): Fläche weiß, Radius 14, Innenabstand 16, Text #1e2b28 / #66736f.
const karte = { background: "#fff", borderRadius: 14, padding: 16, display: "grid", gap: 6, maxWidth: "24rem" } as const;
// Tag wie „Do., 29.10.“; „tag“ ist schon ein Berliner Kalendertag, daher in UTC formatieren.
const tagText = (tag: string) =>
  new Date(tag + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const gedaempft = { color: "#66736f", fontSize: 13, margin: 0 } as const;

// Zeilen gehören dem angemeldeten Nutzer: nie beim Build vorrendern.
export const dynamic = "force-dynamic";

async function ladeWasser() {
  const supabase = await createClient();
  // Acht Tage zurück deckt sieben Berliner Tage auch an der Zeitzonengrenze ab; RLS liefert nur eigene Zeilen.
  const seit = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  return supabase.from("water_logs").select("amount_ml, logged_at").gte("logged_at", seit).order("logged_at");
}

export default async function Page() {
  const { data, error } = await ladeWasser();
  const tage = error ? [] : wasserProTag((data ?? []) as WasserZeile[], new Date());
  const heute = tage.at(-1)?.ml ?? 0;
  return (
    <main style={{ padding: "2rem", background: "#f6f4ee", minHeight: "100vh" }}>
      <h1>Lifestyle App</h1>
      <p>Dein ruhiger Lifestyle-Coach. Bald hier.</p>
      <section aria-labelledby="wasser" style={karte}>
        <h2 id="wasser" style={{ ...gedaempft, fontWeight: 500 }}>Wasser</h2>
        {error ? (
          <p role="alert" style={{ color: "#1e2b28", margin: 0 }}>Wasserdaten konnten nicht geladen werden.</p>
        ) : (
          <>
            <p style={{ color: "#1e2b28", fontSize: 16, fontWeight: 500, margin: 0 }}>
              {glaeser(heute)} von {ZIEL_GLAESER} Gläsern, ohne Druck
            </p>
            {tage.every((t) => t.ml === 0) ? (
              <p style={gedaempft}>Noch keine Einträge in den letzten sieben Tagen.</p>
            ) : (
              <ul style={{ ...gedaempft, paddingLeft: "1.25rem" }}>
                {tage.map((t) => (
                  <li key={t.tag}>
                    {tagText(t.tag)}: {t.ml} ml ({glaeser(t.ml)} × {GLAS_ML} ml)
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      <p>
        <a href="/konto">Konto</a>
      </p>
      <form action="/auth/logout" method="post">
        <button type="submit" style={{ padding: "0.75rem", fontSize: "1rem" }}>
          Abmelden
        </button>
      </form>
    </main>
  );
}
