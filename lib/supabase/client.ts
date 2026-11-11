import { createBrowserClient } from "@supabase/ssr";
import { demoClient, sendeAnRoute } from "../demo/client";
import { istDemo } from "../demo/modus";
import { SUPABASE_SCHEMA, supabaseEnv } from "./env";

export function createClient() {
  if (istDemo()) return demoClient(sendeAnRoute) as unknown as ReturnType<typeof createBrowserClient>;
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey, { db: { schema: SUPABASE_SCHEMA } });
}
