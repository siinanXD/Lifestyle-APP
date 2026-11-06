import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

// Nach Login und Registrierung landet man hier. Wer das Onboarding nicht abgeschlossen oder übersprungen hat, geht dorthin (SIN-1265).
// Bewusst nur auf der Startseite, nicht im Layout: /konto (Konto löschen) bleibt ohne Onboarding erreichbar.
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("onboarding_completed_at").maybeSingle();
  if (error) throw new Error("Profil konnte nicht geladen werden");
  if (!data?.onboarding_completed_at) redirect("/onboarding");
  return (
    <main className="page">
      <h1>Lifestyle App</h1>
      <p>Dein ruhiger Lifestyle-Coach. Bald hier.</p>
      <form action="/auth/logout" method="post">
        <button type="submit" className="btn" data-variant="neutral">
          Abmelden
        </button>
      </form>
    </main>
  );
}
