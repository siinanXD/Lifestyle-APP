import { afterEach, beforeEach, vi } from "vitest";

export const URL_VALUE = "http://127.0.0.1:54321";
export const KEY_VALUE = "test-anon-key";

export function useSupabaseEnv() {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_VALUE);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", KEY_VALUE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
}

export function stubFetch() {
  const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function requestHeaders(fetchMock: ReturnType<typeof stubFetch>) {
  const init = (fetchMock.mock.calls[0] as unknown as [unknown, RequestInit])[1];
  return new Headers(init.headers);
}
