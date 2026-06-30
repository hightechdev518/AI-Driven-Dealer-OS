import type { Cookie, Page } from "playwright-core";
import { saveFbCookies } from "./cookies";
import { ScraperError } from "./types";

type BrowserExtensionCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

function mapExtensionCookies(cookies: BrowserExtensionCookie[]): Cookie[] {
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expirationDate ?? -1,
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? false,
    sameSite:
      c.sameSite === "no_restriction"
        ? "None"
        : c.sameSite === "lax"
          ? "Lax"
          : c.sameSite === "strict"
            ? "Strict"
            : "None",
  }));
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
  return !isLoginUrl(page.url());
}

export function isLoginUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      path === "/login" ||
      path.startsWith("/login/") ||
      path.includes("two_step_verification") ||
      path.includes("checkpoint")
    );
  } catch {
    return url.toLowerCase().includes("/login");
  }
}

export async function isSessionLost(page: Page): Promise<boolean> {
  if (isLoginUrl(page.url())) return true;
  if (await isTwoFactorPage(page)) return true;
  return false;
}

function parseCookiesFromEnv(): Cookie[] {
  const rawCookies = process.env.FB_COOKIES;
  if (!rawCookies) {
    throw new ScraperError(
      "Missing FB_COOKIES in environment",
      "CONFIG"
    );
  }

  let parsedCookies: BrowserExtensionCookie[];
  try {
    parsedCookies = JSON.parse(rawCookies) as BrowserExtensionCookie[];
  } catch {
    throw new ScraperError(
      "FB_COOKIES is not valid JSON",
      "CONFIG"
    );
  }

  if (!Array.isArray(parsedCookies) || parsedCookies.length === 0) {
    throw new ScraperError(
      "FB_COOKIES must be a non-empty JSON array",
      "CONFIG"
    );
  }

  return mapExtensionCookies(parsedCookies);
}

export async function exportCookies(page: Page): Promise<Cookie[]> {
  return page.context().cookies();
}

export async function applyCookies(page: Page, cookies: Cookie[]): Promise<void> {
  if (cookies.length === 0) return;
  await page.context().addCookies(cookies);
}

export async function injectCookies(page: Page): Promise<void> {
  const cookies = parseCookiesFromEnv();

  await page.goto("https://www.facebook.com", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.context().clearCookies();
  await page.context().addCookies(cookies);
}

export async function loginToFacebook(page: Page): Promise<void> {
  await injectCookies(page);

  await page.goto("https://www.facebook.com/marketplace", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.screenshot({ path: "/tmp/fb-cookie-result.png" });
  console.log("Cookie injection result URL:", page.url());

  if (await isLoggedIn(page)) {
    console.log("Cookie injection successful!");
    const contextCookies = await exportCookies(page);
    await saveFbCookies(contextCookies);
    return;
  }

  if (await isTwoFactorPage(page)) {
    throw new ScraperError(
      "Facebook requires two-factor authentication. Update FB_COOKIES with a fresh session.",
      "TWO_FACTOR"
    );
  }

  if (await isBlockedPage(page)) {
    throw new ScraperError(
      "Facebook blocked access. Update FB_COOKIES with a fresh session.",
      "BLOCKED"
    );
  }

  if (isLoginUrl(page.url())) {
    throw new ScraperError(
      "Cookie injection failed. FB_COOKIES may be expired or invalid.",
      "LOGIN"
    );
  }
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  await loginToFacebook(page);
  if (await isTwoFactorPage(page)) {
    throw new ScraperError(
      "Facebook requires two-factor authentication. Update FB_COOKIES with a fresh session.",
      "TWO_FACTOR"
    );
  }
}
