import type { Page } from "playwright-core";
import { loadFbCookies, saveFbCookies } from "./cookies";
import { randomDelay, randomMouseMove } from "./human-behavior";
import { ScraperError } from "./types";

const LOGIN_STEP_TIMEOUT = 60000;

async function clickFacebookLoginButton(page: Page): Promise<void> {
  // Method 1: JavaScript click on the login button
  try {
    await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('button, input[type="submit"]')
      );
      const loginBtn = buttons.find(
        (b) =>
          b.textContent?.includes("Log in") ||
          b.getAttribute("name") === "login" ||
          b.getAttribute("data-testid") === "royal_login_button"
      ) as HTMLElement;
      if (loginBtn) loginBtn.click();
    });
    await page.waitForTimeout(3000);
    return;
  } catch {}

  // Method 2: Press Enter on password field
  try {
    await page.locator("#pass").press("Enter");
    await page.waitForTimeout(3000);
    return;
  } catch {}

  // Method 3: Submit the form directly
  try {
    await page.evaluate(() => {
      const form = document.querySelector("form") as HTMLFormElement;
      if (form) form.submit();
    });
    await page.waitForTimeout(3000);
    return;
  } catch {}

  throw new ScraperError("Could not click Facebook login button", "LOGIN");
}

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

export async function loginToFacebook(page: Page): Promise<void> {
  const email = process.env.FB_EMAIL;
  const password = process.env.FB_PASSWORD;

  if (!email || !password) {
    throw new ScraperError(
      "Missing FB_EMAIL or FB_PASSWORD in environment",
      "CONFIG"
    );
  }

  await page.goto("https://www.facebook.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle");
  await randomDelay();

  if (await isLoggedIn(page)) return;

  const cookies = await loadFbCookies();
  if (cookies.length > 0) {
    await page.context().addCookies(cookies);
    await page.goto("https://www.facebook.com/marketplace", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForLoadState("networkidle");
    await randomDelay();
    if (await isLoggedIn(page)) return;
  }

  await page.goto("https://www.facebook.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle");
  await randomDelay();

  const emailInput = page.locator('input[name="email"], #email').first();
  await emailInput.waitFor({ state: "visible", timeout: LOGIN_STEP_TIMEOUT });
  await randomMouseMove(page);
  await emailInput.fill(email);
  await randomDelay(500, 1200);

  const passInput = page.locator('input[name="pass"], #pass').first();
  await passInput.waitFor({ state: "visible", timeout: LOGIN_STEP_TIMEOUT });
  await passInput.fill(password);
  await randomDelay(500, 1200);

  await clickFacebookLoginButton(page);
  await page.screenshot({ path: "/tmp/fb-screenshot.png" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "/tmp/fb-after-login.png" });
  console.log("After login URL:", page.url());
  console.log("After login Title:", await page.title());
  await randomDelay(2000, 4000);

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
