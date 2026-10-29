import { beforeEach, describe, expect, test, vi } from "vitest";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
const upsert = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession }, from: () => ({ upsert }) }),
}));

import { GET } from "../../app/auth/callback/route";

const get = (query: string) => GET(new Request(`http://localhost:3000/auth/callback${query}`));
const target = (res: Response) => new URL(res.headers.get("location")!);

beforeEach(() => {
  vi.clearAllMocks();
  upsert.mockResolvedValue({ error: null });
});

describe("/auth/callback", () => {
  test("tauscht den Code, legt das Profil an und geht zum Ziel", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await get("?code=abc&next=/passwort-neu");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(upsert).toHaveBeenCalledWith({ id: "u1" }, { onConflict: "id", ignoreDuplicates: true });
    expect(target(res).pathname).toBe("/passwort-neu");
  });

  test("ohne next geht es auf /", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect(target(await get("?code=abc")).pathname).toBe("/");
  });

  test("fremdes next wird ignoriert", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const url = target(await get("?code=abc&next=//evil.example"));
    expect(url.host).toBe("localhost:3000");
    expect(url.pathname).toBe("/");
  });

  test("ungültiger oder fehlender Code führt zu /login?fehler=link", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { code: "flow_state_not_found" } });
    expect(target(await get("?code=alt")).search).toBe("?fehler=link");
    expect(target(await get("")).search).toBe("?fehler=link");
  });

  test("scheitert das Profil, gibt es keine Weiterleitung ins Innere", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    upsert.mockResolvedValue({ error: { code: "42501" } });
    expect(target(await get("?code=abc")).search).toBe("?fehler=link");
  });
});
