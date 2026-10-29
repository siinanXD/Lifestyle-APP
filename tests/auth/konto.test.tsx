import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DeleteAccount } from "../../app/konto/delete-account";

const rpc = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({ rpc, auth: { signOut } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("löscht erst nach einer zweiten Bestätigung", () => {
  render(<DeleteAccount />);
  fireEvent.click(screen.getByRole("button", { name: "Konto löschen" }));
  expect(rpc).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Ja, alle meine Daten löschen" })).toBeTruthy();
});

test("löscht die Lifestyle-Daten, meldet ab und geht zu /login", async () => {
  rpc.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  render(<DeleteAccount />);
  fireEvent.click(screen.getByRole("button", { name: "Konto löschen" }));
  fireEvent.click(screen.getByRole("button", { name: "Ja, alle meine Daten löschen" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(rpc).toHaveBeenCalledWith("delete_own_data");
  expect(signOut).toHaveBeenCalledOnce();
});

test("meldet bei einem Fehler nicht ab und sagt es ruhig", async () => {
  rpc.mockResolvedValue({ error: { code: "42501" } });
  render(<DeleteAccount />);
  fireEvent.click(screen.getByRole("button", { name: "Konto löschen" }));
  fireEvent.click(screen.getByRole("button", { name: "Ja, alle meine Daten löschen" }));
  expect(await screen.findByText(/nicht geklappt/)).toBeTruthy();
  expect(signOut).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});
