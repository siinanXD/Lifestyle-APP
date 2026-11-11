"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../../../lib/supabase/client";
import type { Plan } from "../../../../../lib/training/plan";
import { speicherePlan, type KatalogUebung } from "../../../../../lib/training/plan-eingabe";
import { PLAN_HINWEISE } from "../../../../../lib/training/plan-texte";

const FEHLER = "Das hat gerade nicht geklappt. Dein bisheriger Plan ist unverändert. Bitte versuch es gleich noch einmal.";
export const OHNE_BESCHWERDEN = "Allgemeiner Plan, ohne Rücksicht auf Beschwerden.";

export function PlanVorschlag({ plan, ohneBeschwerden }: { plan: Plan<KatalogUebung>; ohneBeschwerden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const leer = !plan.tage.some((t) => t.positionen.length > 0);

  async function uebernehmen() {
    setBusy(true);
    setFehler("");
    const r = await speicherePlan(createClient(), plan);
    if (!r.ok) {
      setBusy(false);
      return setFehler(FEHLER);
    }
    router.push("/training");
    router.refresh();
  }

  return (
    <main className="page stack">
      {plan.allgemein && <p className="eyebrow">Allgemeiner Vorschlag</p>}
      <h1>Dein Planvorschlag</h1>
      <p className="muted">Das ist ein Vorschlag. Du entscheidest, was du davon machst.</p>
      {ohneBeschwerden && <p className="muted">{OHNE_BESCHWERDEN}</p>}
      {plan.hinweise.map((h) => (
        <p key={h} className="muted">
          {PLAN_HINWEISE[h]}
        </p>
      ))}
      {plan.tage.map((tag) => (
        <section key={tag.tagNr} className="card stack" aria-label={`Tag ${tag.tagNr}`}>
          <h2>
            Tag {tag.tagNr}: {tag.bezeichnung}
          </h2>
          {tag.positionen.length === 0 ? (
            <p className="muted">Für diesen Tag passt gerade keine Übung zu deinen Angaben.</p>
          ) : (
            <ul className="summary">
              {tag.positionen.map((p) => (
                <li key={p.uebung.id}>
                  {p.uebung.name}: {p.saetze} × {p.wdhMin}–{p.wdhMax}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <button type="button" className="btn" disabled={busy || leer} onClick={uebernehmen}>
        Übernehmen
      </button>
      <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => router.refresh()}>
        Neu berechnen
      </button>
      <Link href="/onboarding" className="link">
        Angaben ändern
      </Link>
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}
    </main>
  );
}
