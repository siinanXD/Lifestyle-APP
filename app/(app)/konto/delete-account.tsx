"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_own_data");
    if (error) {
      setError("Das hat gerade nicht geklappt. Deine Daten sind noch da. Bitte versuch es gleich noch einmal.");
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn" data-variant="danger">
        Konto löschen
      </button>
    );
  }
  return (
    <div className="stack">
      <p>Damit löschst du alle deine Daten in der Lifestyle App. Das lässt sich nicht rückgängig machen.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="button" disabled={busy} onClick={remove} className="btn" data-variant="danger">
        Ja, alle meine Daten löschen
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="btn" data-variant="neutral">
        Abbrechen
      </button>
    </div>
  );
}
