import { chromium, firefox } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "playwright-core";
import {
  getCdpEndpoint,
  type MultiloginProfileSession,
} from "./multilogin";

chromium.use(StealthPlugin());

export async function connectMultiloginBrowser(
  session: MultiloginProfileSession
): Promise<Browser> {
  const wsUrl = await getCdpEndpoint(session.browserUrl);
  const engine = session.browserType === "stealthfox" ? firefox : chromium;

  return engine.connectOverCDP(wsUrl, { timeout: 30000 });
}
