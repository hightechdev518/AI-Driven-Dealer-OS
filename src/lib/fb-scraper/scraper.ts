import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { ensureLoggedIn, isBlockedPage } from "./fb-auth";
import {
  humanScroll,
  randomDelay,
} from "./human-behavior";
import {
  getMultiloginConfig,
  getCdpWebSocketUrl,
  startMultiloginProfile,
  stopMultiloginProfile,
} from "./multilogin";
import {
  FbListing,
  FbSearchParams,
  ScraperError,
} from "./types";

chromium.use(StealthPlugin());

function parsePrice(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Math.round(parseFloat(match[1])) : null;
}

function parseMileage(text: string): number | null {
  const match = text.replace(/,/g, "").match(/(\d[\d,]*)\s*(?:mi|miles|km)?/i);
  if (!match) return null;
  const value = parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function parseDaysListed(text: string): number | null {
  const lower = text.toLowerCase();
  if (lower.includes("just listed") || lower.includes("today")) return 0;
  const match = lower.match(/(\d+)\s*(?:day|week|month|hour)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (lower.includes("week")) return n * 7;
  if (lower.includes("month")) return n * 30;
  if (lower.includes("hour")) return 0;
  return n;
}

function parseYearFromTitle(title: string): number | null {
  const match = title.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

function buildSearchQuery(params: FbSearchParams): string {
  const parts: string[] = [];
  if (params.yearFrom && params.yearTo && params.yearFrom === params.yearTo) {
    parts.push(String(params.yearFrom));
  }
  if (params.make) parts.push(params.make);
  if (params.model) parts.push(params.model);
  return parts.join(" ").trim();
}

async function loginToFacebook(page: Page): Promise<void> {
  await ensureLoggedIn(page);
}

async function setMarketplaceLocation(
  page: Page,
  location: string,
  radius: number
): Promise<void> {
  if (!location.trim()) return;

  const locationInput = page
    .locator(
      'input[aria-label*="Location"], input[placeholder*="Location"], input[placeholder*="location"]'
    )
    .first();

  if ((await locationInput.count()) === 0) return;

  try {
    await locationInput.click();
    await randomDelay();
    await locationInput.fill(location);
    await randomDelay(1000, 2000);

    const suggestion = page
      .locator('[role="option"], [role="listbox"] [role="option"]')
      .first();
    if ((await suggestion.count()) > 0) {
      await suggestion.click();
      await randomDelay();
    } else {
      await page.keyboard.press("Enter");
      await randomDelay();
    }

    const radiusSelect = page.locator("text=/\\d+ miles/").first();
    if ((await radiusSelect.count()) > 0) {
      await radiusSelect.click();
      await randomDelay();
      const radiusOption = page.locator(`text="${radius} miles"`).first();
      if ((await radiusOption.count()) > 0) {
        await radiusOption.click();
        await randomDelay();
      }
    }
  } catch (error) {
    console.warn("Could not set marketplace location:", error);
  }
}

async function fillFilterField(
  page: Page,
  labels: string[],
  value: string | number
): Promise<void> {
  for (const label of labels) {
    const field = page.getByLabel(label, { exact: false }).first();
    if ((await field.count()) > 0) {
      await field.fill(String(value));
      await randomDelay(300, 700);
      return;
    }
  }
}

async function applyMarketplaceFilters(
  page: Page,
  params: FbSearchParams
): Promise<void> {
  const filtersButton = page
    .locator(
      'button:has-text("Filters"), [aria-label*="Filters"], a:has-text("Filters")'
    )
    .first();

  if ((await filtersButton.count()) === 0) return;

  try {
    await filtersButton.click();
    await randomDelay(1500, 2500);

    if (params.priceMin > 0) {
      await fillFilterField(page, ["Min price", "Minimum price", "Price from"], params.priceMin);
    }
    if (params.priceMax > 0) {
      await fillFilterField(page, ["Max price", "Maximum price", "Price to"], params.priceMax);
    }
    if (params.yearFrom > 0) {
      await fillFilterField(page, ["Min year", "Year from", "From year"], params.yearFrom);
    }
    if (params.yearTo > 0) {
      await fillFilterField(page, ["Max year", "Year to", "To year"], params.yearTo);
    }
    if (params.mileageMax > 0) {
      await fillFilterField(
        page,
        ["Max mileage", "Maximum mileage", "Mileage"],
        params.mileageMax
      );
    }

    const applyButton = page
      .locator(
        'button:has-text("Apply"), button:has-text("Show results"), [aria-label*="Apply"]'
      )
      .first();
    if ((await applyButton.count()) > 0) {
      await applyButton.click();
      await randomDelay(2000, 3500);
    }
  } catch (error) {
    console.warn("Could not apply all marketplace filters via UI:", error);
  }
}

async function extractListings(
  page: Page,
  params: FbSearchParams
): Promise<FbListing[]> {
  const seen = new Set<string>();
  const results: FbListing[] = [];

  while (results.length < params.resultLimit) {
    const batch = await page.evaluate(() => {
      const items: Array<{
        title: string;
        priceText: string;
        locationText: string;
        daysText: string;
        url: string;
      }> = [];

      const links = document.querySelectorAll('a[href*="/marketplace/item/"]');
      links.forEach((link) => {
        const anchor = link as HTMLAnchorElement;
        const href = anchor.href.split("?")[0];
        if (!href || items.some((i) => i.url === href)) return;

        const aria = anchor.getAttribute("aria-label") || "";
        const card =
          anchor.closest('[data-testid="marketplace-item"]') ||
          anchor.closest('[role="article"]') ||
          anchor.parentElement?.parentElement;

        const cardText = card?.textContent?.replace(/\s+/g, " ").trim() || "";
        const combined = `${aria} ${cardText}`.trim();

        const priceMatch = combined.match(/\$[\d,]+(?:\.\d{2})?/);
        const title =
          aria.split(".")[0]?.trim() ||
          combined.split("$")[0]?.trim() ||
          "Marketplace listing";

        items.push({
          title,
          priceText: priceMatch?.[0] || "",
          locationText: combined,
          daysText: combined,
          url: href,
        });
      });

      return items;
    });

    for (const item of batch) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      const price = parsePrice(item.priceText);
      const mileage = parseMileage(item.title + " " + item.locationText);
      const daysListed = parseDaysListed(item.daysText);
      const year =
        parseYearFromTitle(item.title) ||
        (params.yearFrom === params.yearTo ? params.yearFrom : null);

      if (params.priceMin > 0 && price != null && price < params.priceMin) continue;
      if (params.priceMax > 0 && price != null && price > params.priceMax) continue;
      if (params.mileageMax > 0 && mileage != null && mileage > params.mileageMax) {
        continue;
      }
      if (year != null) {
        if (params.yearFrom > 0 && year < params.yearFrom) continue;
        if (params.yearTo > 0 && year > params.yearTo) continue;
      }

      results.push({
        title: item.title,
        price,
        mileage,
        location: extractLocation(item.locationText),
        daysListed,
        url: item.url,
        year,
        make: params.make || null,
        model: params.model || null,
      });

      if (results.length >= params.resultLimit) break;
    }

    if (results.length >= params.resultLimit) break;

    const previousCount = seen.size;
    await humanScroll(page, 3);
    await randomDelay(1500, 2500);

    const newCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/marketplace/item/"]').length;
    });

    if (newCount <= previousCount) break;
  }

  return results.slice(0, params.resultLimit);
}

function extractLocation(text: string): string | null {
  const patterns = [
    /(?:in|at)\s+([A-Za-z\s]+,\s*[A-Z]{2})/i,
    /([A-Za-z\s]+,\s*[A-Z]{2}\s*\d{0,5})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

async function scrapeWithPage(
  page: Page,
  params: FbSearchParams,
  isRetry: boolean
): Promise<FbListing[]> {
  await page.setViewportSize({
    width: 1366 + Math.floor(Math.random() * 200),
    height: 768 + Math.floor(Math.random() * 100),
  });

  await loginToFacebook(page);

  const query = buildSearchQuery(params);
  const searchUrl = query
    ? `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(query)}`
    : "https://www.facebook.com/marketplace/category/vehicles";

  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await randomDelay(2000, 3500);

  if (await isBlockedPage(page)) {
    if (!isRetry) {
      console.warn("Blocked on marketplace, waiting and retrying once...");
      await randomDelay(5000, 8000);
      return scrapeWithPage(page, params, true);
    }
    throw new ScraperError(
      "Facebook blocked marketplace access. Wait and try again.",
      "BLOCKED"
    );
  }

  await setMarketplaceLocation(page, params.location, params.radius);
  await applyMarketplaceFilters(page, params);
  await humanScroll(page, 2);

  const vehiclesLink = page.locator('a[href*="/marketplace/category/vehicles"]').first();
  if ((await vehiclesLink.count()) > 0 && !page.url().includes("vehicles")) {
    await vehiclesLink.click();
    await randomDelay(2000, 3000);
  }

  return extractListings(page, params);
}

async function getBrowserContext(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = browser.contexts()[0];
  if (!context) {
    throw new ScraperError(
      "No browser context from Multilogin profile",
      "MULTILOGIN"
    );
  }

  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
}

export async function scrapeFacebookMarketplace(
  params: FbSearchParams
): Promise<FbListing[]> {
  const config = await getMultiloginConfig();
  let browser: Browser | null = null;

  try {
    const browserUrl = await startMultiloginProfile(config);
    await randomDelay(2000, 3000);

    const wsUrl = await getCdpWebSocketUrl(browserUrl);
    browser = await chromium.connectOverCDP(wsUrl, {
      timeout: 30000,
    });

    const { page } = await getBrowserContext(browser);
    const results = await scrapeWithPage(page, params, false);

    console.log(
      `FB scraper: found ${results.length} listings for ${params.make} ${params.model}`
    );

    return results;
  } catch (error) {
    if (error instanceof ScraperError) throw error;
    console.error("FB scraper error:", error);
    throw new ScraperError(
      error instanceof Error ? error.message : "Unknown scraping error",
      "SCRAPE"
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error("Error closing browser:", error);
      }
    }
    await stopMultiloginProfile(config);
  }
}

export function parseSearchParams(body: Record<string, unknown>): FbSearchParams {
  return {
    make: String(body.make ?? "").trim(),
    model: String(body.model ?? "").trim(),
    yearFrom: Number(body.yearFrom) || 0,
    yearTo: Number(body.yearTo) || 0,
    mileageMax: Number(body.mileageMax) || 0,
    priceMin: Number(body.priceMin) || 0,
    priceMax: Number(body.priceMax) || 0,
    location: String(body.location ?? "").trim(),
    radius: Number(body.radius) || 25,
    resultLimit: Number(body.resultLimit) || 25,
  };
}
