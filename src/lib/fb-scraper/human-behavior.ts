import type { Page } from "playwright-core";

export function randomDelay(minMs = 1000, maxMs = 3000): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function randomMouseMove(page: Page): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1366, height: 768 };
  const x = Math.floor(Math.random() * (viewport.width - 200)) + 100;
  const y = Math.floor(Math.random() * (viewport.height - 200)) + 100;
  const steps = 8 + Math.floor(Math.random() * 12);
  await page.mouse.move(x, y, { steps });
}

export async function humanScroll(page: Page, scrollCount = 5): Promise<void> {
  for (let i = 0; i < scrollCount; i++) {
    const delta = 250 + Math.floor(Math.random() * 450);
    await page.mouse.wheel(0, delta);
    await randomDelay(800, 1800);
    if (Math.random() > 0.6) {
      await randomMouseMove(page);
    }
  }
}

export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();
  const box = await element.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.3 + Math.random() * 0.4);
    await page.mouse.move(x, y, { steps: 10 });
    await randomDelay(200, 600);
  }
  await element.click();
  await randomDelay();
}

export function fieldDelay(): Promise<void> {
  return randomDelay(500, 2000);
}

export async function humanType(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  text: string
): Promise<void> {
  await locator.first().click();
  await fieldDelay();
  await locator.first().fill("");
  for (const char of text) {
    await page.keyboard.type(char, {
      delay: 40 + Math.floor(Math.random() * 80),
    });
  }
  await fieldDelay();
}
