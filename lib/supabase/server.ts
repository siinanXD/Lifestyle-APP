import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_SCHEMA, supabaseEnv } from "./env";

export async function createClient() {
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
