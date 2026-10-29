import { describe, expect, test, vi } from "vitest";
import { createClient } from "../../lib/supabase/client";
import { KEY_VALUE, requestHeaders, stubFetch, useSupabaseEnv } from "./env";

describe("createClient (Browser)", () => {
  useSupabaseEnv();

  test("gibt bei gesetzten Variablen einen Client zurück", () => {
    expect(typeof createClient().auth.getSession).toBe("function");
  });

  test("wirft verständlich ohne NEXT_PUBLIC_SUPABASE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => createClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  test("wirft verständlich ohne NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => createClient()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  test("nutzt das Schema lifestyle als Standard", async () => {
    const fetchMock = stubFetch();
    await createClient().from("profiles").select();
    const headers = requestHeaders(fetchMock);
    expect(headers.get("Accept-Profile")).toBe("lifestyle");
    expect(headers.get("apikey")).toBe(KEY_VALUE);
  });
});
