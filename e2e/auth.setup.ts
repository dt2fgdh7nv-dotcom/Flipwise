import { test as setup, type Page } from "@playwright/test";
import { PASSWORD, STATE } from "./state";

/** Sign in once per demo user and reuse the session (sign-in is rate limited: 3 per 10 s). */

async function signIn(page: Page, email: string, file: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(app|portal)/);
  await page.context().storageState({ path: file });
}

setup("sign in demo users", async ({ page, browser }) => {
  await signIn(page, "demo@flipwise.fi", STATE.owner);
  const ctx = await browser.newContext();
  await signIn(await ctx.newPage(), "client@flipwise.fi", STATE.client);
  await ctx.close();
});
