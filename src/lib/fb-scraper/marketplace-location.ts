import type { Page } from "playwright-core";
import { isSessionLost } from "./fb-auth";
import type { FbSearchParams } from "./types";
import { ScraperError } from "./types";
import { randomDelay } from "./human-behavior";

/** Facebook Marketplace only accepts these radius values in search URLs (miles). */
export const FB_RADIUS_OPTIONS = [1, 2, 5, 10, 20, 40, 60, 80, 100, 250, 500] as const;

/** Facebook Marketplace metro centers with verified URL slugs. */
const METRO_CENTERS: Array<{
  slug: string;
  name: string;
  lat: number;
  lng: number;
}> = [
  { slug: "nyc", name: "New York City", lat: 40.7128, lng: -74.006 },
  { slug: "la", name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { slug: "sanfrancisco", name: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { slug: "chicago", name: "Chicago", lat: 41.8781, lng: -87.6298 },
  { slug: "austin", name: "Austin", lat: 30.2672, lng: -97.7431 },
  { slug: "boston", name: "Boston", lat: 42.3601, lng: -71.0589 },
  { slug: "seattle", name: "Seattle", lat: 47.6062, lng: -122.3321 },
  { slug: "atlanta", name: "Atlanta", lat: 33.749, lng: -84.388 },
  { slug: "miami", name: "Miami", lat: 25.7617, lng: -80.1918 },
  { slug: "orlando", name: "Orlando", lat: 28.5383, lng: -81.3792 },
  { slug: "tampa", name: "Tampa", lat: 27.9506, lng: -82.4572 },
  { slug: "portland", name: "Portland", lat: 45.5152, lng: -122.6784 },
  { slug: "dallas", name: "Dallas", lat: 32.7767, lng: -96.797 },
  { slug: "houston", name: "Houston", lat: 29.7604, lng: -95.3698 },
  { slug: "denver", name: "Denver", lat: 39.7392, lng: -104.9903 },
  { slug: "phoenix", name: "Phoenix", lat: 33.4484, lng: -112.074 },
  { slug: "lasvegas", name: "Las Vegas", lat: 36.1699, lng: -115.1398 },
  { slug: "philadelphia", name: "Philadelphia", lat: 39.9526, lng: -75.1652 },
  { slug: "detroit", name: "Detroit", lat: 42.3314, lng: -83.0458 },
  { slug: "minneapolis", name: "Minneapolis", lat: 44.9778, lng: -93.265 },
  { slug: "nashville", name: "Nashville", lat: 36.1627, lng: -86.7816 },
  { slug: "charlotte", name: "Charlotte", lat: 35.2271, lng: -80.8431 },
  { slug: "sandiego", name: "San Diego", lat: 32.7157, lng: -117.1611 },
  { slug: "sacramento", name: "Sacramento", lat: 38.5816, lng: -121.4944 },
  { slug: "cleveland", name: "Cleveland", lat: 41.4993, lng: -81.6944 },
  { slug: "pittsburgh", name: "Pittsburgh", lat: 40.4406, lng: -79.9959 },
  { slug: "kansascity", name: "Kansas City", lat: 39.0997, lng: -94.5786 },
  { slug: "stlouis", name: "St. Louis", lat: 38.627, lng: -90.1994 },
  { slug: "saltlakecity", name: "Salt Lake City", lat: 40.7608, lng: -111.891 },
  { slug: "raleigh", name: "Raleigh", lat: 35.7796, lng: -78.6382 },
  { slug: "indianapolis", name: "Indianapolis", lat: 39.7684, lng: -86.1581 },
  { slug: "columbus", name: "Columbus", lat: 39.9612, lng: -82.9988 },
  { slug: "sanantonio", name: "San Antonio", lat: 29.4241, lng: -98.4936 },
  { slug: "fortworth", name: "Fort Worth", lat: 32.7555, lng: -97.3308 },
];

/** Map cities/states to verified Facebook slugs before falling back to nearest metro. */
const CITY_SLUGS: Record<string, string> = {
  "new york, ny": "nyc",
  "new york city, ny": "nyc",
  "brooklyn, ny": "nyc",
  "north bergen, nj": "nyc",
  "jersey city, nj": "nyc",
  "newark, nj": "nyc",
  "hoboken, nj": "nyc",
  "los angeles, ca": "la",
  "beverly hills, ca": "la",
  "santa monica, ca": "la",
  "san francisco, ca": "sanfrancisco",
  "oakland, ca": "sanfrancisco",
  "san jose, ca": "sanfrancisco",
  "rockledge, fl": "orlando",
  "melbourne, fl": "orlando",
  "palm bay, fl": "orlando",
  "cocoa, fl": "orlando",
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

const STATE_NAME_TO_ABBREV: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function normalizeState(value: string): string {
  const trimmed = value.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return STATE_NAME_TO_ABBREV[normalizeKey(trimmed)] ?? trimmed.toUpperCase();
}

function parseCityStateInput(
  location: string
): { city: string; state: string } | null {
  const trimmed = location.trim();
  if (!trimmed || /^\d{5}$/.test(trimmed)) return null;

  const commaMatch = trimmed.match(/^([^,]+),\s*(.+)$/);
  if (commaMatch) {
    return {
      city: commaMatch[1].trim(),
      state: normalizeState(commaMatch[2]),
    };
  }

  const spaceMatch = trimmed.match(/^(.+?)\s+([A-Za-z]{2})$/);
  if (spaceMatch) {
    return {
      city: spaceMatch[1].trim(),
      state: spaceMatch[2].toUpperCase(),
    };
  }

  return null;
}

function matchMetroSlugFromCityName(city: string): string | null {
  const key = normalizeKey(city);
  for (const metro of METRO_CENTERS) {
    if (
      normalizeKey(metro.name) === key ||
      metro.slug === key.replace(/\s+/g, "") ||
      normalizeKey(metro.name).startsWith(key) ||
      key.startsWith(normalizeKey(metro.name))
    ) {
      return metro.slug;
    }
  }
  return null;
}

async function fetchCityStateGeo(
  city: string,
  state: string
): Promise<LocationGeo | null> {
  try {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "DealerAIOS-MarketSearch/1.0",
        },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const place = data[0];
    if (!place) return null;
    return {
      city,
      state: state.toUpperCase(),
      latitude: Number.parseFloat(place.lat),
      longitude: Number.parseFloat(place.lon),
    };
  } catch {
    return null;
  }
}

export interface LocationGeo {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  zip?: string;
}

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

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestMetroSlug(lat: number, lng: number): string {
  let best = METRO_CENTERS[0];
  let bestDistance = Infinity;

  for (const metro of METRO_CENTERS) {
    const distance = haversineMiles(lat, lng, metro.lat, metro.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = metro;
    }
  }

  console.log(
    `Nearest Marketplace metro for (${lat.toFixed(4)}, ${lng.toFixed(4)}): ${best.slug} (${best.name}, ~${bestDistance.toFixed(0)} mi)`
  );
  return best.slug;
}

export function snapRadiusMiles(radius: number): number {
  const target = Number.isFinite(radius) && radius > 0 ? radius : 40;
  return FB_RADIUS_OPTIONS.reduce((closest, option) =>
    Math.abs(option - target) < Math.abs(closest - target) ? option : closest
  );
}

async function fetchZipGeo(zip: string): Promise<LocationGeo | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: Array<{
        "place name": string;
        "state abbreviation": string;
        latitude: string;
        longitude: string;
      }>;
    };
    const place = data.places?.[0];
    if (!place) return null;
    return {
      city: place["place name"],
      state: place["state abbreviation"],
      latitude: Number.parseFloat(place.latitude),
      longitude: Number.parseFloat(place.longitude),
      zip,
    };
  } catch {
    return null;
  }
}

export async function resolveLocationGeo(
  location: string
): Promise<LocationGeo | null> {
  const trimmed = location.trim();
  if (!trimmed) return null;

  if (/^\d{5}$/.test(trimmed)) {
    return fetchZipGeo(trimmed);
  }

  const parsed = parseCityStateInput(trimmed);
  if (parsed) {
    const geocoded = await fetchCityStateGeo(parsed.city, parsed.state);
    if (geocoded) return geocoded;
    return {
      city: parsed.city,
      state: parsed.state,
      latitude: NaN,
      longitude: NaN,
    };
  }

  const metroSlug = matchMetroSlugFromCityName(trimmed);
  if (metroSlug) {
    const metro = METRO_CENTERS.find((entry) => entry.slug === metroSlug);
    if (metro) {
      return {
        city: metro.name,
        state: "",
        latitude: metro.lat,
        longitude: metro.lng,
      };
    }
  }

  return null;
}

export async function resolveLocationSlug(
  location: string
): Promise<string | null> {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const geo = await resolveLocationGeo(trimmed);
  if (geo) {
    const mapped = CITY_SLUGS[cityStateKey(geo.city, geo.state)];
    if (mapped) return mapped;

    if (Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude)) {
      return findNearestMetroSlug(geo.latitude, geo.longitude);
    }

    const metroFromCity = matchMetroSlugFromCityName(geo.city);
    if (metroFromCity) return metroFromCity;
  }

  const parsed = parseCityStateInput(trimmed);
  if (parsed) {
    const mapped = CITY_SLUGS[cityStateKey(parsed.city, parsed.state)];
    if (mapped) return mapped;
    const metroFromCity = matchMetroSlugFromCityName(parsed.city);
    if (metroFromCity) return metroFromCity;
  }

  const mapped = CITY_SLUGS[normalizeKey(trimmed)];
  if (mapped) return mapped;

  return matchMetroSlugFromCityName(trimmed);
}

/** Text to type into Facebook's location picker (ZIP works best). */
export async function resolveLocationPickerQuery(
  location: string
): Promise<{ query: string; stateHint?: string }> {
  const trimmed = location.trim();
  const geo = await resolveLocationGeo(trimmed);
  if (geo?.zip) {
    return { query: geo.zip, stateHint: geo.state };
  }
  if (geo) {
    return {
      query: `${geo.city}, ${geo.state}`,
      stateHint: geo.state,
    };
  }
  return { query: trimmed };
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

export async function gotoMetroBrowsePage(
  page: Page,
  slug: string
): Promise<boolean> {
  const metroUrl = `https://www.facebook.com/marketplace/${slug}`;
  console.log(`Opening Marketplace metro browse: ${metroUrl}`);

  try {
    await page.goto(metroUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await randomDelay(2000, 3000);
  } catch (error) {
    console.warn(`Failed to open metro browse page for ${slug}:`, error);
    return false;
  }

  if (await isSessionLost(page)) return false;

  const onMarketplace = page.url().toLowerCase().includes("marketplace");
  const onTargetMetro = page.url()
    .toLowerCase()
    .includes(`/marketplace/${slug.toLowerCase()}`);

  if (onTargetMetro) return true;
  if (onMarketplace) {
    console.warn(
      `Metro browse for "${slug}" landed on ${page.url()} (generic marketplace)`
    );
    return true;
  }
  return false;
}

export function getMarketplaceSlugFromUrl(pageUrl: string): string | null {
  try {
    const match = new URL(pageUrl).pathname.match(/\/marketplace\/([^/]+)\//i);
    if (!match) return null;
    const slug = match[1].toLowerCase();
    if (slug === "category" || slug === "item" || slug === "create") {
      return null;
    }
    return slug;
  } catch {
    return null;
  }
}

export async function ensureMarketplaceHome(page: Page): Promise<void> {
  if (page.url().toLowerCase().includes("marketplace")) {
    if (!(await isSessionLost(page))) {
      return;
    }
  }

  console.log(
    `Navigating to Marketplace home (current URL: ${page.url()})`
  );
  await page.goto("https://www.facebook.com/marketplace", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await randomDelay(2000, 3000);

  if (await isSessionLost(page)) {
    throw new ScraperError(
      "Lost Facebook session on Marketplace. Update FB_COOKIES or log in via the Multilogin profile.",
      "LOGIN"
    );
  }

  if (!page.url().toLowerCase().includes("marketplace")) {
    throw new ScraperError(
      `Could not open Facebook Marketplace (landed on ${page.url()}).`,
      "LOGIN"
    );
  }
}

async function openLocationEditor(page: Page): Promise<boolean> {
  const triggerSelectors = [
    '[aria-label*="Change location" i]',
    '[aria-label*="location" i]',
    'div[role="button"]:has-text("miles")',
    'div[role="button"]:has-text("Within")',
    'span:has-text("Within")',
    'a[href*="/marketplace/"]:has-text("miles")',
    'div[role="button"]:has-text("mi")',
  ];

  for (const selector of triggerSelectors) {
    const trigger = page.locator(selector).first();
    if ((await trigger.count()) > 0) {
      await trigger.click({ force: true });
      await randomDelay(800, 1200);
      return true;
    }
  }

  return false;
}

async function selectLocationSuggestion(
  page: Page,
  stateHint?: string
): Promise<void> {
  await page.waitForTimeout(1500);
  const options = page.locator(
    '[role="option"], [role="listbox"] [role="option"]'
  );
  const count = await options.count();

  if (count === 0) {
    await page.keyboard.press("Enter");
    await randomDelay(800, 1200);
    return;
  }

  if (stateHint) {
    for (let i = 0; i < count; i++) {
      const text = (await options.nth(i).innerText()).toUpperCase();
      if (text.includes(stateHint.toUpperCase())) {
        await options.nth(i).click();
        await randomDelay(800, 1200);
        return;
      }
    }
  }

  await options.first().click();
  await randomDelay(800, 1200);
}

async function applyRadiusSelection(
  page: Page,
  snappedRadius: number
): Promise<void> {
  const radiusOption = page.locator(`text="${snappedRadius} miles"`).first();
  if ((await radiusOption.count()) > 0) {
    await radiusOption.click();
    await randomDelay(500, 800);
    return;
  }

  const radiusSelect = page.locator("text=/\\d+ miles/").first();
  if ((await radiusSelect.count()) > 0) {
    await radiusSelect.click();
    await randomDelay(400, 700);
    const fallbackRadius = page.locator(`text="${snappedRadius} miles"`).first();
    if ((await fallbackRadius.count()) > 0) {
      await fallbackRadius.click();
      await randomDelay(500, 800);
    }
  }
}

async function confirmLocationDialog(page: Page): Promise<void> {
  const applyButton = page
    .locator(
      'button:has-text("Apply"), button:has-text("Save"), [aria-label*="Apply" i]'
    )
    .first();
  if ((await applyButton.count()) > 0) {
    await applyButton.click();
    await randomDelay(2000, 3500);
  }
}

/**
 * Apply location on the current Marketplace page (home or search results).
 * Works best after a search when the left-side location filter is visible.
 */
export async function applyMarketplaceSearchLocation(
  page: Page,
  location: string,
  radius: number
): Promise<boolean> {
  if (!location.trim()) return false;

  const snappedRadius = snapRadiusMiles(radius);
  const { query: pickerQuery, stateHint } =
    await resolveLocationPickerQuery(location);

  try {
    if (!page.url().toLowerCase().includes("marketplace")) {
      await ensureMarketplaceHome(page);
    }

    const opened = await openLocationEditor(page);

    const locationInput = page
      .locator(
        [
          'input[aria-label*="Location" i]',
          'input[placeholder*="Location" i]',
          'input[placeholder*="City" i]',
          'input[placeholder*="ZIP" i]',
          'input[placeholder*="zip" i]',
          'div[role="dialog"] input[type="text"]',
          'div[role="dialog"] input[type="search"]',
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
      await locationInput.fill(pickerQuery);
      await randomDelay(1500, 2500);
      await selectLocationSuggestion(page, stateHint);
    }

    await applyRadiusSelection(page, snappedRadius);
    await confirmLocationDialog(page);
    await page.waitForLoadState("networkidle").catch(() => {});
    await randomDelay(2000, 3000);

    console.log(
      `Marketplace location applied: ${pickerQuery} (${snappedRadius} mi), URL: ${page.url()}`
    );
    return true;
  } catch (error) {
    console.warn("Could not apply marketplace location:", error);
    return false;
  }
}

/** @deprecated Use applyMarketplaceSearchLocation */
export async function setMarketplaceLocationViaPicker(
  page: Page,
  location: string,
  radius: number,
  allowRetry = true
): Promise<boolean> {
  const applied = await applyMarketplaceSearchLocation(page, location, radius);
  if (applied) return true;

  if (allowRetry && !page.url().toLowerCase().includes("marketplace")) {
    await ensureMarketplaceHome(page);
    return setMarketplaceLocationViaPicker(page, location, radius, false);
  }

  return false;
}
