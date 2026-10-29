import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// Lokaler Stack: `supabase start`, dann SUPABASE_URL und SUPABASE_ANON_KEY aus `supabase status -o env` setzen.
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = process.env;

test("config.toml gibt Schema lifestyle über die API frei", () => {
  const toml = readFileSync("supabase/config.toml", "utf8");
  expect(toml).toMatch(/^schemas = \[.*"lifestyle".*\]$/m);
  expect(toml).toMatch(/^extra_search_path = \[.*"lifestyle".*\]$/m);
});

describe.skipIf(!url || !anonKey)("REST-API gegen lokalen Stack", () => {
  test("Nutzer liest und schreibt eigenes profiles-Row über Schema lifestyle", async () => {
    const headers = { apikey: anonKey!, "Content-Type": "application/json" };
    const signup = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: `rest-${Date.now()}@example.test`, password: "test-passwort-123" }),
    });
    const { access_token, user } = await signup.json();
    expect(access_token).toBeTruthy();
    const auth = { ...headers, Authorization: `Bearer ${access_token}` };

    const insert = await fetch(`${url}/rest/v1/profiles`, {
      method: "POST",
      headers: { ...auth, "Content-Profile": "lifestyle" },
      body: JSON.stringify({ id: user.id, display_name: "Test" }),
    });
    expect(insert.status).toBe(201);

    const read = await fetch(`${url}/rest/v1/profiles?select=id,display_name`, {
      headers: { ...auth, "Accept-Profile": "lifestyle" },
    });
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual([{ id: user.id, display_name: "Test" }]);
  });
});
