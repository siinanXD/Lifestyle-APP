import type { Antwort, Op } from "./db";
import { DEMO_NUTZER } from "./modus";

// Sieht für die App aus wie ein Supabase-Client (SIN-1623): zeichnet die Kette auf und gibt sie beim `await` an `sende`.
// Auf dem Server führt `sende` direkt gegen den Speicher aus, im Browser geht es über die Route /demo/db an denselben Speicher.
export type Anfrage = { tabelle: string; ops: Op[] } | { rpc: string };
export type Sende = (anfrage: Anfrage) => Promise<Antwort>;

const NETZ: Antwort = { data: null, error: { code: "netz", message: "Demo-Speicher nicht erreichbar" } };

function kette(sende: Sende, tabelle: string, ops: Op[]): object {
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          return (ok: (v: Antwort) => unknown, fehler?: (e: unknown) => unknown) => sende({ tabelle, ops }).then(ok, fehler);
        }
        return (...a: unknown[]) => kette(sende, tabelle, [...ops, { m: String(prop), a }]);
      },
    },
  );
}

export function demoClient(sende: Sende) {
  const sitzung = { data: { user: DEMO_NUTZER, session: null }, error: null };
  return {
    // Jede Auth-Methode gelingt als Demo-Nutzer: Anmelden, Abmelden und Registrieren führen einfach weiter.
    auth: new Proxy({}, { get: () => async () => sitzung }),
    from: (tabelle: string) => kette(sende, tabelle, []),
    rpc: (name: string) => sende({ rpc: name }),
  };
}

export const sendeAnRoute: Sende = async (anfrage) => {
  try {
    const antwort = await fetch("/demo/db", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(anfrage) });
    return antwort.ok ? ((await antwort.json()) as Antwort) : NETZ;
  } catch {
    return NETZ;
  }
};
