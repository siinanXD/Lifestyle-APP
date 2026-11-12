"use client";

import Link from "next/link";
import { useState } from "react";
import { uebernehmeAusRezept } from "../../../../../lib/kochen/einkauf";
import { findeRezept } from "../../../../../lib/kochen/rezepte";
import { createClient } from "../../../../../lib/supabase/client";

/** Setzt die fehlenden Zutaten des Rezepts auf die Einkaufsliste (SIN-1627). */
export function AufListe({ slug, fehlend }: { slug: string; fehlend: string[] }) {
  const [stand, setStand] = useState<"offen" | "laeuft" | "fertig" | "fehler">("offen");
  const rezept = findeRezept(slug);
  if (!rezept || fehlend.length === 0) return null;

  async function uebernehmen() {
    if (!rezept) return;
    setStand("laeuft");
    const r = await uebernehmeAusRezept(createClient(), rezept, fehlend);
    setStand(r.ok ? "fertig" : "fehler");
  }

  if (stand === "fertig")
    return (
      <p role="status">
        {fehlend.length === 1 ? "1 Zutat steht" : `${fehlend.length} Zutaten stehen`} auf der Einkaufsliste.{" "}
        <Link href="/kochen/einkauf" className="link">
          Zur Einkaufsliste
        </Link>
      </p>
    );
  return (
    <>
      <button type="button" className="btn" disabled={stand === "laeuft"} onClick={uebernehmen}>
        Fehlendes auf die Einkaufsliste
      </button>
      {stand === "fehler" && (
        <p role="alert" className="error">
          Das hat gerade nicht geklappt. Auf der Einkaufsliste hat sich nichts geändert. Bitte versuch es gleich noch einmal.
        </p>
      )}
    </>
  );
}
