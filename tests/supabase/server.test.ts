import { describe, expect, test, vi } from "vitest";
import { createClient } from "../../lib/supabase/server";
import { requestHeaders, stubFetch, useSupabaseEnv } from "./env";

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));

describe("createClient (Server)", () => {
  useSupabaseEnv();

  test("gibt bei gesetzten Variablen einen Client zurück", async () => {
    expect(typeof (await createClient()).auth.getSession).toBe("function");
  });

  test("wirft verständlich ohne NEXT_PUBLIC_SUPABASE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(createClient()).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  test("wirft verständlich ohne NEXT_PUBLIC_SUPABASE_ANON_KEY", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    await expect(createClient()).rejects.toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  test("nutzt das Schema lifestyle als Standard", async () => {
    const fetchMock = stubFetch();
    await (await createClient()).from("profiles").select();
    expect(requestHeaders(fetchMock).get("Accept-Profile")).toBe("lifestyle");
  });
});
