"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { hatDaten, widerrufe } from "../../../../lib/consent/kategorien";
import { EINWILLIGUNGSTEXTE, type Art } from "../../../../lib/consent/texte";
import { createClient } from "../../../../lib/supabase/client";

export function Widerruf({ art }: { art: Art }) {
  const router = useRouter();
  const [fragen, setFragen] = useState(false);
  const [loeschen, setLoeschen] = useState(true); // Standardvorschlag laut docs/PRIVACY.md: Daten mit löschen
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");

  async function bestaetigen() {
    setBusy(true);
    setFehler("");
    const { error, widerrufen } = await widerrufe(createClient(), art, { datenLoeschen: hatDaten(art) && loeschen });
    setBusy(false);
    if (error) {
      return setFehler(
        widerrufen
          ? "Die Einwilligung ist widerrufen, aber die Daten sind noch nicht vollständig gelöscht. Bitte tippe noch einmal auf „Ja, widerrufen“."
          : "Das hat gerade nicht geklappt. Die Einwilligung gilt noch. Bitte versuch es gleich noch einmal.",
      );
    }
    setFragen(false);
    router.refresh();
  }

  if (!fragen) {
    return (
      <button type="button" className="btn" data-variant="neutral" onClick={() => setFragen(true)}>
        Widerrufen
      </button>
    );
  }
  return (
    <div className="stack">
      <p>Einwilligung „{EINWILLIGUNGSTEXTE[art].titel}“ widerrufen? Die Funktion ist danach ausgeblendet; du kannst sie jederzeit wieder erteilen.</p>
      {hatDaten(art) ? (
        <label className="toggle">
          <input type="checkbox" checked={loeschen} onChange={(e) => setLoeschen(e.target.checked)} />
          Zugehörige Daten auch löschen
        </label>
      ) : (
        <p className="muted">Zu dieser Einwilligung sind keine Daten gespeichert.</p>
      )}
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}
      <button type="button" className="btn" data-variant="danger" disabled={busy} onClick={bestaetigen}>
        Ja, widerrufen
      </button>
      <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => setFragen(false)}>
        Abbrechen
      </button>
    </div>
  );
}
