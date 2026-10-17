import { expect, test, type Page } from "@playwright/test";
import { STATE } from "./state";

/** Smoke test against the seeded demo data (pnpm db:seed). Screenshots go to test-results/screens. */
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true });

async function openKallio(page: Page) {
  await page.goto("/app/projects");
  await page.getByText("Kallio 2h+k — 1930s classic").first().click();
  await expect(page.getByRole("heading", { name: "Kallio 2h+k — 1930s classic" })).toBeVisible();
}

test.describe("flipper", () => {
  test.use({ storageState: STATE.owner });

  test("dashboard, project tabs and settings", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await shot(page, "01-dashboard");
    await page.goto("/app/projects");
    await shot(page, "02-projects-board");
    await openKallio(page);
    await expect(page.getByText("Asbestos survey required before renovation").first()).toBeVisible();
    await shot(page, "03-overview");
    for (const [tab, heading, name] of [
      ["Deal analysis", "Results", "04-deal"],
      ["Taloyhtiö & PTS", "Planned maintenance (PTS)", "05-housing"],
      ["Comparables & market", "Comparable sales", "06-comparables"],
      ["Sharing", "Share with clients", "07-sharing"],
    ] as const) {
      await page.getByRole("link", { name: tab, exact: true }).click();
      await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
      await shot(page, name);
    }
    await page.goto("/app/settings/config");
    await expect(page.getByText("Transfer tax — housing company shares")).toBeVisible();
    await shot(page, "08-config");
  });

  test("deal analysis recalculates live and can discard", async ({ page }) => {
    await openKallio(page);
    await page.getByRole("link", { name: "Deal analysis", exact: true }).click();
    const profit = page.getByText(/^€[\d,]+$/).first();
    const before = await profit.textContent();
    await page.locator("#offerPrice").fill("190000");
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await expect(profit).not.toHaveText(before!);
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(profit).toHaveText(before!);
  });

  test("new project flow", async ({ page }) => {
    await page.goto("/app/projects/new");
    await page.locator("#prop-streetAddress").fill("Testikatu 1");
    await page.locator("#prop-postalCode").fill("00100");
    await page.locator("#prop-municipality").fill("Helsinki");
    await page.locator("#prop-livingAreaM2").fill("35");
    await page.locator("#prop-rooms").fill("1");
    await page.locator("#prop-buildYear").fill("1962");
    await page.locator("#askingPrice").fill("180000");
    await page.locator("#maintenanceFeeMonthly").fill("180");
    await page.locator("#expectedSalePrice").fill("230000");
    await page.locator("#renovationBudget").fill("20000");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/deal$/);
    await expect(page.getByText("Results", { exact: true })).toBeVisible();
    // clean up
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete project" }).click();
    await page.waitForURL(/\/app\/projects$/);
  });
});

test.describe("client", () => {
  test.use({ storageState: STATE.client });

  test("sees only shared projects", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.getByText("Kallio 2h+k — 1930s classic")).toBeVisible();
    await expect(page.getByText("Porvoo rivitalo")).toHaveCount(0);
    await shot(page, "09-portal");
    await page.getByText("Kallio 2h+k — 1930s classic").click();
    await expect(page.getByText("You can comment")).toBeVisible();
    await shot(page, "10-portal-project");
    await page.goto("/app");
    await expect(page).toHaveURL(/\/portal/);
  });
});
