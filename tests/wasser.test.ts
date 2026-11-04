import { expect, test } from "vitest";
import { glaeser, wasserProTag } from "../lib/wasser";

const jetzt = new Date("2026-11-03T12:00:00Z");

test("wasserProTag liefert sieben Tage, ältester zuerst, Tage ohne Eintrag mit 0", () => {
  const tage = wasserProTag(
    [
      { amount_ml: 250, logged_at: "2026-11-03T08:00:00.000Z" },
      { amount_ml: 400, logged_at: "2026-11-03T10:00:00.000Z" },
      { amount_ml: 300, logged_at: "2026-10-30T10:00:00.000Z" },
    ],
    jetzt,
  );
  expect(tage.map((t) => t.tag)).toEqual([
    "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03",
  ]);
  expect(tage.map((t) => t.ml)).toEqual([0, 0, 300, 0, 0, 0, 650]);
});

test("Tage zählen nach Berliner Zeit: 23:30 UTC gehört schon zum nächsten Tag", () => {
  const tage = wasserProTag([{ amount_ml: 200, logged_at: "2026-11-02T23:30:00.000Z" }], jetzt);
  expect(tage.at(-1)).toEqual({ tag: "2026-11-03", ml: 200 });
  expect(tage.at(-2)?.ml).toBe(0);
});

test("glaeser: 250 ml ein Glas, abgerundet", () => {
  expect(glaeser(0)).toBe(0);
  expect(glaeser(249)).toBe(0);
  expect(glaeser(1999)).toBe(7);
  expect(glaeser(2000)).toBe(8);
});
