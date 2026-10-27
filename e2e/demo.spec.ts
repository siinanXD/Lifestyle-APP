import { expect, test } from "@playwright/test";

test("Startseite und Demo-Zähler", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Lifestyle App" })).toBeVisible();
  await page.goto("/demo");
  for (let i = 1; i <= 3; i++) {
    await page.getByRole("button", { name: "Wasser getrunken" }).click();
    await expect(page.getByText(`Gläser heute: ${i}`)).toBeVisible();
    await page.waitForTimeout(400); // damit das Video etwas zeigt
  }
});
