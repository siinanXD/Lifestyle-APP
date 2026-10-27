import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Page from "../app/page";

test("Startseite zeigt Platzhaltertext", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1, name: "Lifestyle App" })).toBeTruthy();
  expect(screen.getByText("Dein ruhiger Lifestyle-Coach. Bald hier.")).toBeTruthy();
});
