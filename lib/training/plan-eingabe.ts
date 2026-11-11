import { hatEinwilligung, type Einwilligungszeile } from "../consent/consent";
import type { createClient } from "../supabase/client";
import { fuehreAus, nutzerId, type Ergebnis } from "./log";
import type { Angaben, Plan, Uebung } from "./plan";

// Sammelt die Eingabe für die Plan-Engine und legt ihr Ergebnis ab (SIN-1284). Fehler kommen als Ergebnis zurück, nie als Exception.
type Client = ReturnType<typeof createClient>;

export type KatalogUebung = Uebung & { id: string; name: string };
export type PlanEingabe = {
  angaben: Angaben;
  katalog: KatalogUebung[];
  /** true = ohne Einwilligung B: allgemeiner Plan, ohne Rücksicht auf Beschwerden. */
  ohneBeschwerden: boolean;
};

export const PLAN_NAME = "Mein Plan";
// Annahme (keine Vorgabe von Sinan): Eine Comeback-Angabe wirkt 28 Tage auf neue Pläne, danach nicht mehr.
const COMEBACK_GILT_TAGE = 28;

type Profilzeile = {
  goals: string[] | null;
  days_per_week: number | null;
  minutes_per_session: number | null;
  experience: string | null;
  equipment: string[] | null;
};

const gefuellt = <T>(liste: T[] | null | undefined) => (liste?.length ? liste : undefined);
const ohneFehlende = <T extends object>(obj: T) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export async function ladePlanEingabe(client: Client): Promise<Ergebnis<PlanEingabe>> {
  const einwilligungen = await fuehreAus<Einwilligungszeile[]>(client.from("consents").select("kind, revoked_at").eq("kind", "B"));
  if (!einwilligungen.ok) return einwilligungen;
  const mitB = hatEinwilligung(einwilligungen.daten ?? [], "B");

  const profil = await fuehreAus<Profilzeile | null>(
    client.from("profiles").select("goals, days_per_week, minutes_per_session, experience, equipment").maybeSingle(),
  );
  if (!profil.ok) return profil;

  // Gesundheitsangaben nur mit offener Einwilligung B lesen; ohne B entsteht der Plan ohne sie.
  let einschraenkungen: string[] | undefined;
  let comebackStufe: Angaben["comebackStufe"];
  if (mitB) {
    const gesundheit = await fuehreAus<{ restrictions: string[] | null } | null>(
      client.from("health_profile").select("restrictions").maybeSingle(),
    );
    if (!gesundheit.ok) return gesundheit;
    einschraenkungen = gefuellt(gesundheit.daten?.restrictions);
    const comeback = await fuehreAus<{ level: number; created_at: string } | null>(
      client.from("comeback_checkins").select("level, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    );
    if (!comeback.ok) return comeback;
    const c = comeback.daten;
    if (c && Date.now() - new Date(c.created_at).getTime() < COMEBACK_GILT_TAGE * 24 * 60 * 60 * 1000) {
      comebackStufe = c.level as Angaben["comebackStufe"];
    }
  }

  const katalog = await fuehreAus<KatalogUebung[] | null>(
    client.from("exercises").select("id, slug, name, category, muscle_groups, equipment, joints, variant_of"),
  );
  if (!katalog.ok) return katalog;

  const p = profil.daten;
  return {
    ok: true,
    daten: {
      angaben: ohneFehlende({
        ziele: gefuellt(p?.goals),
        tageProWoche: p?.days_per_week ?? undefined,
        minutenProEinheit: p?.minutes_per_session ?? undefined,
        erfahrung: p?.experience ?? undefined,
        geraete: gefuellt(p?.equipment),
        einschraenkungen,
        comebackStufe,
      } as Angaben),
      katalog: (katalog.daten ?? []).map((u) => ({ ...u, joints: u.joints ?? [] })),
      ohneBeschwerden: !mitB,
    },
  };
}

/**
 * Legt den Plan an und löst den bisherigen aktiven ab. Ohne Datenbankfunktion, deshalb in dieser Reihenfolge:
 * neuer Plan inaktiv → Positionen → alten deaktivieren → neuen aktivieren. Scheitert ein Schritt, verschwindet der neue Plan
 * und der alte ist (wieder) aktiv. Der Index „ein aktiver Plan je Person“ verhindert zwei aktive Pläne.
 */
export async function speicherePlan(client: Client, plan: Plan<KatalogUebung>): Promise<Ergebnis<{ id: string }>> {
  if (!plan.tage.some((t) => t.positionen.length > 0)) return { ok: false, fehler: "leer" };
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };

  const alt = await fuehreAus<{ id: string } | null>(client.from("training_plans").select("id").eq("active", true).maybeSingle());
  if (!alt.ok) return alt;
  const neu = await fuehreAus<{ id: string }>(
    client
      .from("training_plans")
      .insert({ user_id: userId, name: PLAN_NAME, source: "regeln", general: plan.allgemein, active: false })
      .select("id")
      .single(),
  );
  if (!neu.ok) return neu;
  const id = neu.daten.id;
  const verwerfen = async <T>(fehler: Ergebnis<T>) => {
    await fuehreAus(client.from("training_plans").delete().eq("id", id)); // Positionen hängen per on delete cascade daran
    return fehler as { ok: false; fehler: string };
  };

  const positionen = plan.tage.flatMap((tag) =>
    tag.positionen.map((p, i) => ({
      plan_id: id,
      user_id: userId,
      day_no: tag.tagNr,
      position: i + 1,
      exercise_id: p.uebung.id,
      sets: p.saetze,
      rep_min: p.wdhMin,
      rep_max: p.wdhMax,
    })),
  );
  const items = await fuehreAus<null>(client.from("plan_items").insert(positionen));
  if (!items.ok) return verwerfen(items);

  if (alt.daten) {
    const aus = await fuehreAus<null>(client.from("training_plans").update({ active: false }).eq("id", alt.daten.id));
    if (!aus.ok) return verwerfen(aus);
  }
  const an = await fuehreAus<null>(client.from("training_plans").update({ active: true }).eq("id", id));
  if (!an.ok) {
    if (alt.daten) await fuehreAus(client.from("training_plans").update({ active: true }).eq("id", alt.daten.id));
    return verwerfen(an);
  }
  return { ok: true, daten: { id } };
}
