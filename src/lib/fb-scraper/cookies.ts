import { promises as fs } from "fs";
import path from "path";
import type { Cookie } from "playwright-core";

const COOKIE_FILE = path.join(process.cwd(), "data", "fb-session.json");

export async function loadFbCookies(): Promise<Cookie[]> {
  try {
    const raw = await fs.readFile(COOKIE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Cookie[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveFbCookies(cookies: Cookie[]): Promise<void> {
  await fs.mkdir(path.dirname(COOKIE_FILE), { recursive: true });
  await fs.writeFile(COOKIE_FILE, JSON.stringify(cookies, null, 2), "utf-8");
}
