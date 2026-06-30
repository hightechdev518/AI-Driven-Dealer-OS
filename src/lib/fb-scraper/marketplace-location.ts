import type { Page } from "playwright-core";
import type { FbSearchParams } from "./types";
import { randomDelay } from "./human-behavior";

/** Facebook Marketplace only accepts these radius values in search URLs (miles). */
export const FB_RADIUS_OPTIONS = [1, 2, 5, 10, 20, 40, 60, 80, 100, 250, 500] as const;

/** Verified Facebook Marketplace city slugs (ZIP/city names must map to one of these). */
const CITY_SLUGS: Record<string, string> = {
  "new york, ny": "nyc",
  "new york city, ny": "nyc",
  "brooklyn, ny": "nyc",
  "los angeles, ca": "la",
  "beverly hills, ca": "la",
  "santa monica, ca": "la",
  "san francisco, ca": "sanfrancisco",
  "oakland, ca": "sanfrancisco",
  "san jose, ca": "sanfrancisco",
  "chicago, il": "chicago",
  "austin, tx": "austin",
  "boston, ma": "boston",
  "seattle, wa": "seattle",
  "atlanta, ga": "atlanta",
  "miami, fl": "miami",
  "portland, or": "portland",
  "dallas, tx": "dallas",
  "houston, tx": "houston",
  "denver, co": "denver",
  "phoenix, az": "phoenix",
  "las vegas, nv": "lasvegas",
  "philadelphia, pa": "philadelphia",
  "detroit, mi": "detroit",
  "minneapolis, mn": "minneapolis",
  "nashville, tn": "nashville",
  "charlotte, nc": "charlotte",
  "tampa, fl": "tampa",
  "orlando, fl": "orlando",
  "san diego, ca": "sandiego",
  "sacramento, ca": "sacramento",
  "cleveland, oh": "cleveland",
  "pittsburgh, pa": "pittsburgh",
  "kansas city, mo": "kansascity",
  "st. louis, mo": "stlouis",
  "saint louis, mo": "stlouis",
  "salt lake city, ut": "saltlakecity",
  "raleigh, nc": "raleigh",
  "indianapolis, in": "indianapolis",
  "columbus, oh": "columbus",
  "san antonio, tx": "sanantonio",
  "fort worth, tx": "fortworth",
};

const SLUG_ALIASES: Record<string, string> = {
  nyc: "nyc",
  la: "la",
  sf: "sanfrancisco",
  sanfrancisco: "sanfrancisco",
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cityStateKey(city: string, state: string): string {
  return normalizeKey(`${city}, ${state}`);
}

function slugifyCity(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function snapRadiusMiles(radius: number): number {
  const target = Number.isFinite(radius) && radius > 0 ? radius : 40;
  return FB_RADIUS_OPTIONS.reduce((closest, option) =>
    Math.abs(option - target) < Math.abs(closest - target) ? option : closest
  );
}

async function fetchZipGeo(
  zip: string
): Promise<{ city: string; state: string } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: Array<{ "place name": string; "state abbreviation": string }>;
    };
    const place = data.places?.[0];
    if (!place) return null;
    return {
      city: place["place name"],
      state: place["state abbreviation"],
    };
  } catch {
    return null;
  }
}

export async function resolveLocationSlug(
  location: string
): Promise<string | null> {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const alias = SLUG_ALIASES[normalizeKey(trimmed).replace(/\s+/g, "")];
  if (alias) return alias;

  if (/^\d{5}$/.test(trimmed)) {
    const geo = await fetchZipGeo(trimmed);
    if (geo) {
      const mapped = CITY_SLUGS[cityStateKey(geo.city, geo.state)];
      if (mapped) return mapped;
      return slugifyCity(geo.city) || null;
    }
    return null;
  }

  const commaMatch = trimmed.match(/^([^,]+),\s*([A-Za-z]{2})$/);
  if (commaMatch) {
    const key = cityStateKey(commaMatch[1], commaMatch[2]);
    const mapped = CITY_SLUGS[key];
    if (mapped) return mapped;
    return slugifyCity(commaMatch[1]) || null;
  }

  const mapped = CITY_SLUGS[normalizeKey(trimmed)];
  if (mapped) return mapped;

  const slug = slugifyCity(trimmed);
  return slug || null;
}

export function buildSearchQuery(params: FbSearchParams): string {
  const parts: string[] = [];
  if (params.yearFrom && params.yearTo && params.yearFrom === params.yearTo) {
    parts.push(String(params.yearFrom));
  }
  if (params.make) parts.push(params.make);
  if (params.model) parts.push(params.model);
  return parts.join(" ").trim();
}

export function buildMarketplaceSearchUrl(
  slug: string,
  params: FbSearchParams
): string {
  const query = buildSearchQuery(params);
  const url = new URL(
    `https://www.facebook.com/marketplace/${slug}/search/`
  );
  if (query) url.searchParams.set("query", query);
  url.searchParams.set("radius", String(snapRadiusMiles(params.radius)));
  url.searchParams.set("category", "vehicles");
  url.searchParams.set("exact", "false");
  if (params.priceMin > 0) {
    url.searchParams.set("minPrice", String(Math.round(params.priceMin)));
  }
  if (params.priceMax > 0) {
    url.searchParams.set("maxPrice", String(Math.round(params.priceMax)));
  }
  return url.toString();
}

export function isMarketplaceLocationRedirect(
  pageUrl: string,
  expectedSlug: string
): boolean {
  try {
    const path = new URL(pageUrl).pathname.toLowerCase();
    if (path.includes("/marketplace/category/search")) return true;
    return !path.includes(`/marketplace/${expectedSlug.toLowerCase()}/`);
  } catch {
    return true;
  }
}

export async function setMarketplaceLocationViaPicker(
  page: Page,
  location: string,
  radius: number
): Promise<boolean> {
  if (!location.trim()) return false;

  const snappedRadius = snapRadiusMiles(radius);

  try {
    if (!page.url().includes("marketplace")) {
      await page.goto("https://www.facebook.com/marketplace", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForLoadState("networkidle").catch(() => {});
      await randomDelay(1500, 2500);
    }

    const triggerSelectors = [
      '[aria-label*="Change location" i]',
      '[aria-label*="Location" i]',
      'div[role="button"]:has-text("miles")',
      'div[role="button"]:has-text("mi")',
      'span:has-text("Within")',
      'a[href*="/marketplace/"]:has-text("miles")',
    ];

    let opened = false;
    for (const selector of triggerSelectors) {
      const trigger = page.locator(selector).first();
      if ((await trigger.count()) > 0) {
        await trigger.click({ force: true });
        opened = true;
        await randomDelay(800, 1200);
        break;
      }
    }

    const locationInput = page
      .locator(
        [
          'input[aria-label*="Location" i]',
          'input[placeholder*="Location" i]',
          'input[placeholder*="City" i]',
          'input[placeholder*="ZIP" i]',
          'input[placeholder*="zip" i]',
          'div[role="dialog"] input[type="text"]',
        ].join(", ")
      )
      .first();

    if ((await locationInput.count()) === 0 && !opened) {
      console.warn("Marketplace location picker input not found");
      return false;
    }

    if ((await locationInput.count()) > 0) {
      await locationInput.click({ force: true });
      await locationInput.fill("");
      await randomDelay(200, 400);
      await locationInput.fill(location);
      await randomDelay(1200, 2000);

      const suggestion = page
        .locator('[role="option"], [role="listbox"] [role="option"]')
        .first();
      if ((await suggestion.count()) > 0) {
        await suggestion.click();
        await randomDelay(800, 1200);
      } else {
        await page.keyboard.press("Enter");
        await randomDelay(800, 1200);
      }
    }

    const radiusOption = page
      .locator(`text="${snappedRadius} miles"`)
      .first();
    if ((await radiusOption.count()) > 0) {
      await radiusOption.click();
      await randomDelay(500, 800);
    } else {
      const radiusSelect = page.locator("text=/\\d+ miles/").first();
      if ((await radiusSelect.count()) > 0) {
        await radiusSelect.click();
        await randomDelay(400, 700);
        const fallbackRadius = page
          .locator(`text="${snappedRadius} miles"`)
          .first();
        if ((await fallbackRadius.count()) > 0) {
          await fallbackRadius.click();
          await randomDelay(500, 800);
        }
      }
    }

    const applyButton = page
      .locator(
        'button:has-text("Apply"), button:has-text("Save"), [aria-label*="Apply" i]'
      )
      .first();
    if ((await applyButton.count()) > 0) {
      await applyButton.click();
      await randomDelay(2000, 3500);
    }

    await page.waitForLoadState("networkidle").catch(() => {});
    console.log(
      `Marketplace location picker applied: ${location} (${snappedRadius} mi)`
    );
    return true;
  } catch (error) {
    console.warn("Could not set marketplace location via picker:", error);
    return false;
  }
}
