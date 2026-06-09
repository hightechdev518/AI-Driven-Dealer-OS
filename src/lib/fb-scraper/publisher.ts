import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "playwright-core";
import { ensureLoggedIn, isBlockedPage, isTwoFactorPage } from "./fb-auth";
import {
  fieldDelay,
  humanScroll,
  humanType,
  randomDelay,
  randomMouseMove,
} from "./human-behavior";
import {
  getMultiloginConfig,
  startMultiloginProfile,
  stopMultiloginProfile,
} from "./multilogin";
import { ScraperError } from "./types";

chromium.use(StealthPlugin());

export interface PublishParams {
  vehicleId: string;
  title: string;
  description: string;
  price: number;
  photos: string[];
  location: string;
  category: string;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
}

async function findField(
  page: Page,
  labels: string[]
): Promise<ReturnType<Page["locator"]> | null> {
  for (const label of labels) {
    const byLabel = page.getByLabel(label, { exact: false });
    if ((await byLabel.count()) > 0) return byLabel;
    const byPlaceholder = page.getByPlaceholder(label, { exact: false });
    if ((await byPlaceholder.count()) > 0) return byPlaceholder;
  }
  return null;
}

async function fillField(
  page: Page,
  labels: string[],
  value: string
): Promise<boolean> {
  const field = await findField(page, labels);
  if (!field) return false;
  await humanScroll(page, 1);
  await randomMouseMove(page);
  await humanType(page, field, value);
  return true;
}

async function selectOption(
  page: Page,
  labels: string[],
  optionText: string
): Promise<boolean> {
  const field = await findField(page, labels);
  if (!field) return false;
  await field.first().click();
  await fieldDelay();
  const option = page.getByRole("option", { name: optionText, exact: false }).first();
  if ((await option.count()) > 0) {
    await option.click();
    await fieldDelay();
    return true;
  }
  const textOption = page.locator(`text="${optionText}"`).first();
  if ((await textOption.count()) > 0) {
    await textOption.click();
    await fieldDelay();
    return true;
  }
  return false;
}

async function downloadPhoto(url: string, destDir: string, index: number): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download photo: ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = url.match(/\.(jpe?g|png|webp|gif)/i)?.[1] ?? "jpg";
  const filePath = path.join(destDir, `photo-${index}.${ext}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function uploadPhoto(
  page: Page,
  filePath: string,
  isRetry: boolean
): Promise<boolean> {
  try {
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) === 0) {
      const addPhotos = page
        .locator(
          'button:has-text("Add photos"), button:has-text("Add Photos"), [aria-label*="photo"]'
        )
        .first();
      if ((await addPhotos.count()) > 0) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 10000 }),
          addPhotos.click(),
        ]);
        await fileChooser.setFiles(filePath);
      } else {
        await fileInput.setInputFiles(filePath);
      }
    } else {
      await fileInput.setInputFiles(filePath);
    }
    await fieldDelay();
    return true;
  } catch (error) {
    console.error("Photo upload failed:", error);
    if (!isRetry) {
      await randomDelay(2000, 3000);
      return uploadPhoto(page, filePath, true);
    }
    return false;
  }
}

async function extractListingUrl(page: Page): Promise<string | null> {
  await randomDelay(3000, 5000);

  const url = page.url();
  if (url.includes("/marketplace/item/")) {
    return url.split("?")[0];
  }

  const itemLink = page.locator('a[href*="/marketplace/item/"]').first();
  if ((await itemLink.count()) > 0) {
    const href = await itemLink.getAttribute("href");
    if (href) {
      return href.startsWith("http")
        ? href.split("?")[0]
        : `https://www.facebook.com${href.split("?")[0]}`;
    }
  }

  return null;
}

async function publishListingOnPage(
  page: Page,
  params: PublishParams
): Promise<string> {
  await page.setViewportSize({
    width: 1366 + Math.floor(Math.random() * 200),
    height: 768 + Math.floor(Math.random() * 100),
  });

  await ensureLoggedIn(page);

  await page.goto("https://www.facebook.com/marketplace/create/vehicle", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await randomDelay(2000, 3500);

  if (await isTwoFactorPage(page)) {
    throw new ScraperError(
      "Facebook requires two-factor authentication. Check your phone to approve login, then retry.",
      "TWO_FACTOR"
    );
  }

  if (await isBlockedPage(page)) {
    throw new ScraperError(
      "Facebook blocked access. Try again later.",
      "BLOCKED"
    );
  }

  await humanScroll(page, 2);

  if (params.year) {
    await fillField(page, ["Year", "Vehicle year"], String(params.year));
  }
  if (params.make) {
    await fillField(page, ["Make", "Vehicle make"], params.make);
  }
  if (params.model) {
    await fillField(page, ["Model", "Vehicle model"], params.model);
  }
  if (params.mileage) {
    await fillField(page, ["Mileage", "Odometer"], String(params.mileage));
  }
  if (params.price) {
    await fillField(page, ["Price", "Listing price"], String(params.price));
  }

  await selectOption(page, ["Condition", "Vehicle condition"], "Used");
  await fieldDelay();

  if (params.description) {
    const descField = await findField(page, [
      "Description",
      "Tell buyers about your vehicle",
    ]);
    if (descField) {
      await humanType(page, descField, params.description);
    }
  }

  if (params.location) {
    await fillField(page, ["Location", "Zip code", "City"], params.location);
    const suggestion = page.locator('[role="option"]').first();
    if ((await suggestion.count()) > 0) {
      await suggestion.click();
      await fieldDelay();
    }
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fb-publish-"));
  const uploaded: string[] = [];

  try {
    for (let i = 0; i < params.photos.length; i++) {
      const photoUrl = params.photos[i];
      try {
        const filePath = await downloadPhoto(photoUrl, tempDir, i);
        const success = await uploadPhoto(page, filePath, false);
        if (success) uploaded.push(photoUrl);
        else console.warn(`Skipped photo after retry: ${photoUrl}`);
        await fieldDelay();
      } catch (error) {
        console.error(`Photo ${i + 1} failed:`, error);
      }
    }

    await humanScroll(page, 2);
    await randomMouseMove(page);

    const publishButton = page
      .locator(
        'button:has-text("Publish"), button:has-text("Post"), [aria-label*="Publish"]'
      )
      .first();

    if ((await publishButton.count()) === 0) {
      throw new ScraperError(
        "Could not find the Publish button on Facebook Marketplace.",
        "PUBLISH"
      );
    }

    await publishButton.click();
    await randomDelay(3000, 5000);

    const listingUrl = await extractListingUrl(page);
    if (!listingUrl) {
      throw new ScraperError(
        "Listing may have been submitted but the URL could not be captured. Check Facebook Marketplace manually.",
        "PUBLISH"
      );
    }

    return listingUrl;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function publishToFacebookMarketplace(
  params: PublishParams
): Promise<{ listingUrl: string; photosUploaded: number }> {
  const config = getMultiloginConfig();
  let browser: Browser | null = null;

  try {
    const browserUrl = await startMultiloginProfile(config);
    await randomDelay(2000, 3000);

    browser = await chromium.connectOverCDP(browserUrl, { timeout: 30000 });
    const context = browser.contexts()[0];
    if (!context) {
      throw new ScraperError("No browser context from Multilogin", "MULTILOGIN");
    }

    const page = context.pages()[0] ?? (await context.newPage());
    const listingUrl = await publishListingOnPage(page, params);

    return {
      listingUrl,
      photosUploaded: params.photos.length,
    };
  } catch (error) {
    if (error instanceof ScraperError) throw error;
    console.error("FB publisher error:", error);
    throw new ScraperError(
      error instanceof Error ? error.message : "Failed to publish listing",
      "PUBLISH"
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
