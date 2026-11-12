import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { proxy } from "../../proxy";
import { useSupabaseEnv } from "../supabase/env";

describe("proxy (Route-Schutz)", () => {
  useSupabaseEnv();

  test("leitet eine Anfrage auf / ohne Sitzung auf /willkommen um (SIN-1571)", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/willkommen");
  });

  test.each(["/login", "/registrieren", "/willkommen"])("lässt %s ohne Sitzung durch", async (path) => {
    const res = await proxy(new NextRequest(`http://localhost:3000${path}`));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
});

describe("proxy (SIN-1198)", () => {
  useSupabaseEnv();

  test.each(["/passwort-vergessen", "/auth/callback"])("lässt %s ohne Sitzung durch", async (path) => {
    const res = await proxy(new NextRequest(`http://localhost:3000${path}`));
    expect(res.headers.get("location")).toBeNull();
  });

  test.each(["/passwort-neu", "/konto"])("schützt %s ohne Sitzung", async (path) => {
    const res = await proxy(new NextRequest(`http://localhost:3000${path}`));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});

describe("proxy (SIN-1571)", () => {
  useSupabaseEnv();

  test("leitet alle anderen geschützten Pfade weiter auf /login", async () => {
    for (const path of ["/konto", "/training", "/essen", "/fortschritt"]) {
      const res = await proxy(new NextRequest(`http://localhost:3000${path}`));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    }
  });

  test("mit Sitzung bleibt / die Startseite", async () => {
    const user = { id: "00000000-0000-0000-0000-00000000000a", aud: "authenticated", role: "authenticated", email: "a@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
    const session = { access_token: "t", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(user), { status: 200 })));
    const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
    const res = await proxy(new NextRequest("http://localhost:3000/", { headers: { cookie } }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
});

test("Matcher: Rezeptfotos und PWA-Dateien laufen nicht durch den Route-Schutz, App-Seiten schon", async () => {
  const { config } = await import("../../proxy");
  const trifft = (pfad: string) => new RegExp(`^${config.matcher[0]}$`).test(pfad);
  expect(trifft("/rezepte/carbonara.webp")).toBe(false);
  expect(trifft("/icon-192.png")).toBe(false);
  expect(trifft("/_next/static/x.js")).toBe(false);
  for (const pfad of ["/", "/kochen", "/kochen/rezept/carbonara", "/kochen/einkauf", "/essen", "/api/barcode/123", "/konto/rezepte/x"]) expect(trifft(pfad), pfad).toBe(true);
});
