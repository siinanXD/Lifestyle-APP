import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { proxy } from "../../proxy";
import { useSupabaseEnv } from "../supabase/env";

describe("proxy (Route-Schutz)", () => {
  useSupabaseEnv();

  test("leitet eine Anfrage auf / ohne Sitzung auf /login um", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  test.each(["/login", "/registrieren"])("lässt %s ohne Sitzung durch", async (path) => {
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
