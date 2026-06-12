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

const LOGIN_BUTTON_SELECTORS = [
  'input[type="submit"]',
  'button[name="login"]',
  '[data-testid="royal_login_button"]',
  'button:has-text("Log in")',
  'button:has-text("Log In")',
];

async function clickLoginButtonFallback(page: Page): Promise<void> {
  for (const selector of LOGIN_BUTTON_SELECTORS) {
    const button = page.locator(selector).first();
    if ((await button.count()) === 0) continue;

    try {
      await button.click({ force: true });
      await page.waitForTimeout(3000);
      return;
    } catch {
      continue;
    }
  }
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

  await page.goto("https://www.facebook.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  await page.fill("#email", process.env.FB_EMAIL!);
  await page.waitForTimeout(1000);
  await page.fill("#pass", process.env.FB_PASSWORD!);
  await page.waitForTimeout(1000);

  await page.keyboard.press("Enter");
  await page.waitForTimeout(8000);

  await page.screenshot({ path: "/tmp/fb-after-enter.png" });
  console.log("URL:", page.url());
  console.log("Title:", await page.title());

  if (!(await isLoggedIn(page))) {
    await clickLoginButtonFallback(page);
  }

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

  if (!(await isLoggedIn(page))) {
    await page.goto("https://www.facebook.com/marketplace", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  if (!(await isLoggedIn(page))) {
    throw new ScraperError(
      "Facebook login failed. Check FB_EMAIL and FB_PASSWORD.",
      "LOGIN"
    );
  }

  const contextCookies = await page.context().cookies();
  await saveFbCookies(contextCookies);
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
