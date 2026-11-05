import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync("app/globals.css", "utf8");
const light = css.match(/:root\s*\{([^}]*)\}/)![1];
const dark = css.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/)![1];

const colors = (block: string) => Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Vordergrund, Hintergrund: jede Textfarbe muss auf ihrem Untergrund lesbar sein.
const PAIRS = [
  ["text", "bg"], ["text", "surface"], ["muted", "bg"], ["muted", "surface"], ["link", "bg"], ["link", "surface"],
  ["on-primary", "primary"], ["on-danger", "danger"], ["danger-text", "bg"], ["danger-text", "surface"],
];

describe.each([["hell", light], ["dunkel", dark]])("Design-Tokens %s (SIN-1254)", (_, block) => {
  const c = colors(block);
  test.each(PAIRS)("%s auf %s hat Kontrast ≥ 4,5:1", (fg, bg) => {
    expect(c[fg], `--color-${fg}`).toBeDefined();
    expect(c[bg], `--color-${bg}`).toBeDefined();
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

test("Schriftgrößen-Tokens liegen bei mindestens 16 px", () => {
  const sizes = [...css.matchAll(/--font-[\w-]+:\s*([\d.]+)rem/g)].map((m) => Number(m[1]) * 16);
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
});

test("Tab-Ziele sind mindestens 44 px hoch", () => {
  expect(css).toMatch(/--tap-min:\s*2\.75rem/);
});
