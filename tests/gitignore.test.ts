import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

// SIN-1610: Git liest C:\Dev\.gitignore nicht; die Regeln müssen in der .gitignore des Repos stehen.
const ignoriert = (pfad: string) => {
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", pfad]);
    return true;
  } catch {
    return false;
  }
};

test.each([".env", ".env.local", ".env.production.local", "server.pem", "id.key", "credentials.json", "secrets.txt"])(
  "%s wird ignoriert",
  (pfad) => expect(ignoriert(pfad)).toBe(true),
);

test(".env.example bleibt versionierbar", () => {
  expect(ignoriert(".env.example")).toBe(false);
});
