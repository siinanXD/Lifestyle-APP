import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { istDemo } from "../demo/modus";
import { demoServerClient } from "../demo/server";
import { SUPABASE_SCHEMA, supabaseEnv } from "./env";

export async function createClient() {
  if (istDemo()) return demoServerClient() as unknown as ReturnType<typeof createServerClient>;
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    db: { schema: SUPABASE_SCHEMA },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // In Server Components ist Cookie-Schreiben nicht erlaubt; die Sitzung erneuert später der Route-Schutz.
        }
      },
    },
  });
}
