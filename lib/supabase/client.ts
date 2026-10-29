import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_SCHEMA, supabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey, { db: { schema: SUPABASE_SCHEMA } });
}
