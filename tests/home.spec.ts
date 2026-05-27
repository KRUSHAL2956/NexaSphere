import { test, expect } from "@playwright/test";

test.describe("Home Page Sanity Test", () => {
  test("should load successfully and display the correct title", async ({
    page,
  }) => {
    // Navigate to the homepage
    await page.goto("/");

    // Expect the page to have the correct title
    await expect(page).toHaveTitle(/NexaSphere/);
  });
});
