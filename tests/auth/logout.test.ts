import { expect, test, vi } from "vitest";

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut } }),
}));

import { POST } from "../../app/auth/logout/route";

test("Logout meldet ab und leitet auf /login um", async () => {
  const res = await POST(new Request("http://localhost:3000/auth/logout", { method: "POST" }));
  expect(signOut).toHaveBeenCalledOnce();
  expect(res.status).toBe(303);
  expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
});
