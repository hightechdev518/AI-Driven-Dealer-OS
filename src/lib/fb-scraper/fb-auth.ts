import type { Page } from "playwright-core";
import { loadFbCookies, saveFbCookies } from "./cookies";
import { randomDelay } from "./human-behavior";
import { ScraperError } from "./types";

export async function isTwoFactorPage(page: Page): Promise<boolean> {
  const url = page.url();
  if (
    url.includes("two_factor") ||
    url.includes("checkpoint") ||
    url.includes("approvals")
  ) {
    return true;
  }
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return (
    /two[- ]factor|login code|authentication app|confirm your identity/i.test(
      bodyText
    ) && !bodyText.toLowerCase().includes("marketplace")
  );
}

export async function isBlockedPage(page: Page): Promise<boolean> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return /temporarily blocked|unusual activity|confirm it's you|security check/i.test(
    bodyText
  );
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("/login") || url.includes("checkpoint")) return false;

  const loginForm = page.locator('input[name="email"], input#email');
  if ((await loginForm.count()) > 0 && (await loginForm.first().isVisible())) {
    return false;
  }

  const loggedInSignals = page.locator(
    '[aria-label="Your profile"], [aria-label="Account"], a[href*="/marketplace"]'
  );
  return (await loggedInSignals.count()) > 0;
}

function isPostLoginUrl(url: string): boolean {
  return (
    url.includes("facebook.com") &&
    !url.includes("/login") &&
    !url.includes("checkpoint")
  );
}

export async function loginToFacebook(page: Page): Promise<void> {
  const email = process.env.FB_EMAIL;
  const password = process.env.FB_PASSWORD;

  if (!email || !password) {
    throw new ScraperError(
      "Missing FB_EMAIL or FB_PASSWORD in environment",
      "CONFIG"
    );
  }

  const cookies = await loadFbCookies();
  if (cookies.length > 0) {
    await page.context().addCookies(cookies);
    await page.goto("https://www.facebook.com/marketplace", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await randomDelay();
    if (await isLoggedIn(page)) return;
  }

  await page.goto("https://m.facebook.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.fill('input[name="email"]', process.env.FB_EMAIL!);
  await page.waitForTimeout(1000);
  await page.fill('input[name="pass"]', process.env.FB_PASSWORD!);
  await page.waitForTimeout(1000);

  await page.locator('input[name="pass"]').press("Enter");
  await page.waitForTimeout(8000);

  const currentUrl = page.url();
  if (currentUrl.includes("login")) {
    await page.evaluate(() => {
      const form = document.querySelector("form") as HTMLFormElement;
      if (form) form.submit();
    });
    await page.waitForTimeout(5000);
  }

  await page.screenshot({ path: "/tmp/fb-mobile-after.png" });
  console.log("After login URL:", page.url());

  if (await isTwoFactorPage(page)) {
    throw new ScraperError(
      "Facebook requires two-factor authentication. Check your phone to approve login, then retry.",
      "TWO_FACTOR"
    );
  }

  if (await isBlockedPage(page)) {
    throw new ScraperError(
      "Facebook blocked the login attempt. Try again later or verify the account in the Multilogin profile.",
      "BLOCKED"
    );
  }

  if (!isPostLoginUrl(page.url())) {
    throw new ScraperError(
      "Facebook login failed. Check FB_EMAIL and FB_PASSWORD.",
      "LOGIN"
    );
  }

  const contextCookies = await page.context().cookies();
  await saveFbCookies(contextCookies);

  await page.goto("https://www.facebook.com/marketplace", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  await loginToFacebook(page);
  if (await isTwoFactorPage(page)) {
    throw new ScraperError(
      "Facebook requires two-factor authentication. Check your phone to approve login, then retry.",
      "TWO_FACTOR"
    );
  }
}
