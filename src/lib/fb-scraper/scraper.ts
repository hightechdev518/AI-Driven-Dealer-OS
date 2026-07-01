import type { Browser, BrowserContext, Page } from "playwright-core";
import { ensureLoggedIn, isBlockedPage, isSessionLost } from "./fb-auth";
import {
  humanScroll,
  randomDelay,
} from "./human-behavior";
import {
  getMultiloginConfig,
  startMultiloginProfile,
  stopMultiloginProfile,
} from "./multilogin";
import { connectMultiloginBrowser } from "./browser-connect";
import {
  applyMarketplaceSearchLocation,
  buildMarketplaceSearchUrl,
  buildSearchQuery,
  ensureMarketplaceHome,
  gotoMetroBrowsePage,
  isMarketplaceLocationRedirect,
  resolveLocationSlug,
} from "./marketplace-location";
import {
  FbListing,
  FbSearchParams,
  FbSearchResult,
  ScraperError,
} from "./types";

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

const LISTING_SELECTORS = [
  'div[data-testid="marketplace-search-feed-item"]',
  'div[class*="x9f619"][class*="x1n2onr6"]',
  'a[href*="/marketplace/item/"]',
] as const;

async function logListingSelectorCounts(page: Page): Promise<void> {
  for (const selector of LISTING_SELECTORS) {
    const count = await page.locator(selector).count();
    console.log(`Selector "${selector}" found ${count} elements`);
  }
}

async function loginToFacebook(page: Page): Promise<void> {
  await ensureLoggedIn(page);
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
): Promise<FbSearchResult> {
  const seen = new Set<string>();
  const results: FbListing[] = [];
  const skipCount = params.resultBatch * params.resultLimit;
  let skipped = 0;
  let scrollAttempts = 0;
  let feedExhausted = false;
  const maxScrollAttempts = Math.max(
    15,
    Math.ceil((skipCount + params.resultLimit) / 8) + 10
  );

  while (results.length < params.resultLimit) {
    const batch = await page.evaluate(() => {
      const items: Array<{
        title: string;
        priceText: string;
        locationText: string;
        daysText: string;
        url: string;
      }> = [];
      const seenUrls = new Set<string>();

      const addFromAnchor = (link: Element) => {
        const anchor = link as HTMLAnchorElement;
        const href = anchor.href?.split("?")[0];
        if (!href || !href.includes("/marketplace/item/") || seenUrls.has(href)) {
          return;
        }
        seenUrls.add(href);

        const aria = anchor.getAttribute("aria-label") || "";
        const card =
          anchor.closest('[data-testid="marketplace-search-feed-item"]') ||
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
      };

      document
        .querySelectorAll(
          'div[data-testid="marketplace-search-feed-item"] a[href*="/marketplace/item/"]'
        )
        .forEach(addFromAnchor);

      document.querySelectorAll('a[href*="/marketplace/item/"]').forEach(addFromAnchor);

      return items;
    });

    for (const item of batch) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      if (skipped < skipCount) {
        skipped++;
        continue;
      }

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
    scrollAttempts++;

    const newCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/marketplace/item/"]').length;
    });

    if (newCount <= previousCount || scrollAttempts >= maxScrollAttempts) {
      feedExhausted = true;
      break;
    }
  }

  if (skipped < skipCount) {
    feedExhausted = true;
  }

  const listings = results.slice(0, params.resultLimit);
  return {
    results: listings,
    resultBatch: params.resultBatch,
    skipCount,
    hasMore: listings.length >= params.resultLimit && !feedExhausted,
  };
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

async function logMarketplaceSearchState(page: Page): Promise<void> {
  await page.screenshot({ path: "/tmp/fb-marketplace.png" });
  console.log("Marketplace URL:", page.url());
  console.log("Marketplace title:", await page.title());
  await logListingSelectorCounts(page);
}

async function countVisibleListings(page: Page): Promise<number> {
  return page.evaluate(() => {
    return document.querySelectorAll('a[href*="/marketplace/item/"]').length;
  });
}

function hasExtraUiFilters(params: FbSearchParams): boolean {
  return (
    params.yearFrom > 0 ||
    params.yearTo > 0 ||
    params.mileageMax > 0
  );
}

async function runMarketplaceSearchInPage(
  page: Page,
  params: FbSearchParams
): Promise<void> {
  if (!page.url().toLowerCase().includes("marketplace")) {
    await ensureMarketplaceHome(page);
  }

  const query = buildSearchQuery(params);
  if (!query) {
    console.log("No search query provided, using current marketplace page");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(5000);
    await logMarketplaceSearchState(page);
    return;
  }

  console.log(`Searching marketplace in-page for: ${query}`);

  const marketplaceSearch = page
    .locator('input[aria-label="Search Marketplace"]')
    .first();

  if ((await marketplaceSearch.count()) === 0) {
    console.log("Search Marketplace input not found, trying search icon...");
    const searchIcon = page
      .locator(
        '[aria-label*="Search"], button[aria-label*="Search"], [role="button"][aria-label*="Search"]'
      )
      .first();

    if ((await searchIcon.count()) > 0) {
      await searchIcon.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  let searchInput = page
    .locator('input[aria-label="Search Marketplace"]')
    .first();

  if ((await searchInput.count()) === 0) {
    searchInput = page
      .locator('input[placeholder*="Search"], input[aria-label*="Search"]')
      .first();
  }

  if ((await searchInput.count()) === 0) {
    throw new ScraperError(
      "Could not find marketplace search box on current page",
      "SCRAPE"
    );
  }

  await searchInput.click({ force: true });
  await searchInput.fill(query);
  await page.waitForTimeout(1000);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(5000);

  if (await isSessionLost(page)) {
    throw new ScraperError(
      "Lost Facebook session during in-page marketplace search",
      "LOGIN"
    );
  }

  await logMarketplaceSearchState(page);
}

async function tryDirectMarketplaceUrl(
  page: Page,
  slug: string,
  params: FbSearchParams
): Promise<boolean> {
  const searchUrl = buildMarketplaceSearchUrl(slug, params);
  console.log(
    `Trying direct marketplace URL for ${params.location} → slug "${slug}": ${searchUrl}`
  );

  try {
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3000);
  } catch (error) {
    console.warn("Direct marketplace URL navigation failed:", error);
    return false;
  }

  if (await isSessionLost(page)) {
    console.warn(
      `Direct marketplace URL triggered login redirect (${page.url()}), falling back to in-page search`
    );
    return false;
  }

  if (isMarketplaceLocationRedirect(page.url(), slug)) {
    console.warn(
      `Direct marketplace URL lost location slug (now ${page.url()}), falling back to in-page search`
    );
    return false;
  }

  console.log(`Direct marketplace URL succeeded: ${page.url()}`);
  return true;
}

async function navigateMarketplaceSearch(
  page: Page,
  params: FbSearchParams
): Promise<void> {
  const query = buildSearchQuery(params);
  const location = params.location.trim();
  const slug = location ? await resolveLocationSlug(location) : null;

  await ensureMarketplaceHome(page);

  if (location) {
    if (slug) {
      console.log(`Resolved "${location}" to Marketplace metro slug "${slug}"`);
      const metroOk = await gotoMetroBrowsePage(page, slug);
      if (!metroOk) {
        console.warn(
          `Metro browse failed for "${slug}", applying location picker before search`
        );
        await applyMarketplaceSearchLocation(page, location, params.radius);
      }
    } else {
      console.warn(
        `No metro slug for "${location}", applying location picker before search`
      );
      await applyMarketplaceSearchLocation(page, location, params.radius);
    }
  }

  if (location && query && slug) {
    if (await tryDirectMarketplaceUrl(page, slug, params)) {
      const listingCount = await countVisibleListings(page);
      if (listingCount > 0) {
        console.log(
          `Direct URL search found ${listingCount} visible listings for ${location}`
        );
        await logMarketplaceSearchState(page);
        return;
      }
      console.warn(
        `Direct URL loaded but 0 listings visible — falling back to in-page search`
      );
      await gotoMetroBrowsePage(page, slug);
    }
  }

  if (query) {
    await runMarketplaceSearchInPage(page, params);
    const listingCount = await countVisibleListings(page);
    console.log(`In-page search shows ${listingCount} visible listings`);
  } else if (!query) {
    console.log("No vehicle query provided, using current marketplace page");
    await page.waitForTimeout(2000);
    await logMarketplaceSearchState(page);
  }
}

async function scrapeWithPage(
  page: Page,
  params: FbSearchParams,
  isRetry: boolean
): Promise<FbSearchResult> {
  await page.setViewportSize({
    width: 1366 + Math.floor(Math.random() * 200),
    height: 768 + Math.floor(Math.random() * 100),
  });

  await loginToFacebook(page);

  console.log("Staying on marketplace page, searching in-page...");
  console.log("Current URL:", page.url());

  await navigateMarketplaceSearch(page, params);

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

  if (hasExtraUiFilters(params)) {
    await applyMarketplaceFilters(page, params);
  }

  await humanScroll(page, 3);
  await randomDelay(2000, 3000);

  const searchResult = await extractListings(page, params);
  if (searchResult.results.length === 0) {
    const visible = await countVisibleListings(page);
    console.warn(
      `Extracted 0 listings (${visible} item links visible on page at ${page.url()})`
    );
  }
  return searchResult;
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
): Promise<FbSearchResult> {
  const config = await getMultiloginConfig();
  let browser: Browser | null = null;

  try {
    const session = await startMultiloginProfile(config);
    await randomDelay(2000, 3000);

    browser = await connectMultiloginBrowser(session);

    const { page } = await getBrowserContext(browser);
    const searchResult = await scrapeWithPage(page, params, false);

    console.log(
      `FB scraper: found ${searchResult.results.length} listings (batch ${params.resultBatch}, skipped ${searchResult.skipCount}) for ${params.make} ${params.model}`
    );

    return searchResult;
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
    resultBatch: Math.max(0, Number(body.resultBatch) || 0),
  };
}
