import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import { ladeAktivenPlan } from "../../../../lib/training/plan-ablauf";
import { PlanAnsicht } from "./plan-ansicht";

// Liest den Plan der angemeldeten Person; nie vorab rendern. Pläne brauchen keine Einwilligung B (Migration SIN-1282).
export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const supabase = await createClient();
  const [plan, uebungen] = await Promise.all([
    ladeAktivenPlan(supabase as never),
    supabase.from("exercises").select("id, name").order("name"),
  ]);
  if (!plan.ok || uebungen.error) throw new Error("Plan konnte nicht geladen werden");
  if (!plan.daten) {
    return (
      <main className="page stack">
        <h1>Dein Plan</h1>
        <p className="muted">Du hast noch keinen Plan. Du kannst jederzeit auch frei trainieren.</p>
        <Link href="/training/plan/neu" className="btn">
          Plan erstellen
        </Link>
      </main>
    );
  }
  return <PlanAnsicht plan={plan.daten} uebungen={(uebungen.data ?? []) as { id: string; name: string }[]} />;
}
