"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

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
      <button type="button" onClick={() => setConfirming(true)} style={{ padding: "0.75rem", fontSize: "1rem" }}>
        Konto löschen
      </button>
    );
  }
  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <p>Damit löschst du alle deine Daten in der Lifestyle App. Das lässt sich nicht rückgängig machen.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={remove} style={{ padding: "0.75rem", fontSize: "1rem" }}>
        Ja, alle meine Daten löschen
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} style={{ padding: "0.75rem", fontSize: "1rem" }}>
        Abbrechen
      </button>
    </div>
  );
}
