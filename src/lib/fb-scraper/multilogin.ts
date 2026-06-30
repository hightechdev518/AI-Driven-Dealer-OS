import { createHash } from "crypto";
import http from "http";
import { ScraperError } from "./types";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const MLX_API = "https://api.multilogin.com";
const MLX_LAUNCHER =
  process.env.MULTILOGIN_LAUNCHER_URL ?? "http://127.0.0.1:45000";

const LAUNCHER_UNREACHABLE_MSG =
  "Multilogin launcher is not running on this machine (port 45000). Start the Multilogin X app on the same machine as this server, then try again.";

const STOP_DELAY_MS = 3000;
const STOP_POLL_INTERVAL_MS = 500;
const STOP_MAX_ATTEMPTS = 3;
const STOP_POLL_TIMEOUT_MS = 15000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopProfileUrl(profileId: string): string {
  return `${MLX_LAUNCHER}/api/v2/profile/stop/p/${profileId}`;
}

function isConnectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const errnoError = error as NodeJS.ErrnoException;
  return (
    errnoError.code === "ECONNREFUSED" ||
    error.message.toLowerCase().includes("econnrefused")
  );
}

function throwIfLauncherUnreachable(error: unknown): void {
  if (isConnectionRefused(error)) {
    throw new ScraperError(LAUNCHER_UNREACHABLE_MSG, "MULTILOGIN");
  }
}

export type MultiloginBrowserType = "mimic" | "stealthfox";

export interface MultiloginProfileSession {
  browserUrl: string;
  browserType: MultiloginBrowserType;
  port: number;
}

function httpGet(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        resolve(data);
      });
    });
    req.on("error", reject);
    req.end();
  });
}

export interface MultiloginConfig {
  apiToken: string;
  folderId: string;
  profileId: string;
}

function md5Hash(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function normalizeBrowserType(raw?: string): MultiloginBrowserType {
  if (raw?.toLowerCase() === "stealthfox") {
    return "stealthfox";
  }
  return "mimic";
}

function extractWebSocketUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  if (
    "webSocketDebuggerUrl" in data &&
    typeof (data as { webSocketDebuggerUrl?: string }).webSocketDebuggerUrl ===
      "string"
  ) {
    return (data as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl;
  }

  if (Array.isArray(data)) {
    const browserTarget = data.find(
      (target) =>
        target &&
        typeof target === "object" &&
        "webSocketDebuggerUrl" in target &&
        (target as { type?: string }).type === "browser"
    ) as { webSocketDebuggerUrl?: string } | undefined;

    if (browserTarget?.webSocketDebuggerUrl) {
      return browserTarget.webSocketDebuggerUrl;
    }

    const pageTarget = data.find(
      (target) =>
        target &&
        typeof target === "object" &&
        "webSocketDebuggerUrl" in target &&
        (target as { type?: string }).type === "page"
    ) as { webSocketDebuggerUrl?: string } | undefined;

    if (pageTarget?.webSocketDebuggerUrl) {
      return pageTarget.webSocketDebuggerUrl;
    }

    const first = data[0] as { webSocketDebuggerUrl?: string } | undefined;
    if (first?.webSocketDebuggerUrl) {
      return first.webSocketDebuggerUrl;
    }
  }

  return null;
}

export async function getCdpEndpoint(browserUrl: string): Promise<string> {
  const endpoints = [`${browserUrl}/json/version`, `${browserUrl}/json`];
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const wsUrl = extractWebSocketUrl(data);
      if (wsUrl) {
        return wsUrl;
      }

      throw new Error("No webSocketDebuggerUrl in response");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`CDP endpoint failed (${endpoint}):`, lastError.message);
    }
  }

  throw new ScraperError(
    `Failed to get CDP endpoint: ${lastError?.message ?? "unknown error"}`,
    "MULTILOGIN"
  );
}

/** @deprecated Use getCdpEndpoint */
export async function getCdpWebSocketUrl(browserUrl: string): Promise<string> {
  return getCdpEndpoint(browserUrl);
}

export async function signInToMultilogin(): Promise<string> {
  const email = process.env.MULTILOGIN_EMAIL;
  const password = process.env.MULTILOGIN_PASSWORD;

  if (!email || !password) {
    throw new ScraperError(
      "Missing MULTILOGIN_EMAIL or MULTILOGIN_PASSWORD in environment",
      "CONFIG"
    );
  }

  const response = await fetch(`${MLX_API}/user/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      password: md5Hash(password),
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Multilogin sign-in failed:", body);
    throw new ScraperError(
      `Multilogin sign-in failed: ${JSON.stringify(body)}`,
      "MULTILOGIN"
    );
  }

  const token = body?.data?.token;
  if (!token) {
    throw new ScraperError(
      "Multilogin sign-in did not return a token",
      "MULTILOGIN"
    );
  }

  return token;
}

export async function getMultiloginConfig(): Promise<MultiloginConfig> {
  const folderId = process.env.MULTILOGIN_FOLDER_ID;
  const profileId = process.env.MULTILOGIN_PROFILE_ID;

  if (!profileId) {
    throw new ScraperError(
      "Missing MULTILOGIN_PROFILE_ID in environment",
      "CONFIG"
    );
  }

  if (!folderId) {
    throw new ScraperError(
      "Missing MULTILOGIN_FOLDER_ID in environment (required to launch profile)",
      "CONFIG"
    );
  }

  const apiToken = await signInToMultilogin();

  return { apiToken, folderId, profileId };
}

type ActiveProfileEntry = {
  profile_id?: string;
  id?: string;
};

function parseActiveProfiles(data: unknown): ActiveProfileEntry[] {
  if (!data || typeof data !== "object") return [];

  const root = data as Record<string, unknown>;
  const inner = root.data ?? root;

  if (Array.isArray(inner)) {
    return inner as ActiveProfileEntry[];
  }

  if (typeof inner === "object" && inner !== null) {
    const profiles = (inner as { profiles?: unknown }).profiles;
    if (Array.isArray(profiles)) {
      return profiles as ActiveProfileEntry[];
    }
  }

  return [];
}

function profileMatches(entry: ActiveProfileEntry, profileId: string): boolean {
  return entry.profile_id === profileId || entry.id === profileId;
}

export async function isProfileRunning(
  config: MultiloginConfig
): Promise<boolean> {
  try {
    const raw = await httpGet(
      `${MLX_LAUNCHER}/api/v2/profile/active`,
      config.apiToken
    );
    const parsed = JSON.parse(raw) as unknown;
    return parseActiveProfiles(parsed).some((entry) =>
      profileMatches(entry, config.profileId)
    );
  } catch (error) {
    throwIfLauncherUnreachable(error);

    try {
      const raw = await httpGet(
        `${MLX_LAUNCHER}/api/v1/profile/active?profile_id=${config.profileId}`,
        config.apiToken
      );
      const parsed = JSON.parse(raw) as unknown;
      return parseActiveProfiles(parsed).some((entry) =>
        profileMatches(entry, config.profileId)
      );
    } catch (fallbackError) {
      throwIfLauncherUnreachable(fallbackError);
      return false;
    }
  }
}

async function waitUntilProfileStopped(
  config: MultiloginConfig,
  timeoutMs = STOP_POLL_TIMEOUT_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isProfileRunning(config))) {
      return true;
    }
    await sleep(STOP_POLL_INTERVAL_MS);
  }

  return !(await isProfileRunning(config));
}

async function stopAllProfiles(token: string): Promise<void> {
  await httpGet(`${MLX_LAUNCHER}/api/v1/profile/stop_all`, token);
}

export interface MultiloginSessionStopResult {
  stopped: boolean;
  wasRunning: boolean;
}

export async function forceStopMultiloginSession(
  config: MultiloginConfig
): Promise<MultiloginSessionStopResult> {
  const wasRunning = await isProfileRunning(config);

  if (!wasRunning) {
    return { stopped: true, wasRunning: false };
  }

  for (let attempt = 0; attempt < STOP_MAX_ATTEMPTS; attempt++) {
    try {
      await httpGet(stopProfileUrl(config.profileId), config.apiToken);
    } catch (error) {
      throwIfLauncherUnreachable(error);
      console.warn(
        `Multilogin stop attempt ${attempt + 1} failed:`,
        error instanceof Error ? error.message : error
      );
    }

    await sleep(STOP_DELAY_MS);

    if (await waitUntilProfileStopped(config)) {
      return { stopped: true, wasRunning: true };
    }
  }

  try {
    await stopAllProfiles(config.apiToken);
    await sleep(STOP_DELAY_MS);
  } catch (error) {
    throwIfLauncherUnreachable(error);
    console.error("Multilogin stop_all failed:", error);
  }

  const stopped = await waitUntilProfileStopped(config);
  return { stopped, wasRunning: true };
}

export async function startMultiloginProfile(
  config: MultiloginConfig
): Promise<MultiloginProfileSession> {
  await forceStopMultiloginSession(config);

  const url = `${MLX_LAUNCHER}/api/v2/profile/f/${config.folderId}/p/${config.profileId}/start?automation_type=playwright&headless_mode=false`;

  let body: {
    data?: { port?: number; browser_type?: string };
  } = {};

  try {
    const raw = await httpGet(url, config.apiToken);
    body = JSON.parse(raw);
  } catch (error) {
    console.error("Multilogin start profile failed:", error);
    throwIfLauncherUnreachable(error);
    throw new ScraperError(
      `Failed to start Multilogin profile: ${error instanceof Error ? error.message : String(error)}`,
      "MULTILOGIN"
    );
  }

  const port = body?.data?.port;
  if (!port) {
    throw new ScraperError(
      "Multilogin did not return a browser port. Is the Multilogin app running?",
      "MULTILOGIN"
    );
  }

  const browserType = normalizeBrowserType(body?.data?.browser_type);

  return {
    browserUrl: `http://127.0.0.1:${port}`,
    browserType,
    port,
  };
}

export async function stopMultiloginProfile(
  config: MultiloginConfig
): Promise<void> {
  try {
    const result = await forceStopMultiloginSession(config);
    if (!result.stopped) {
      console.error(
        "Multilogin profile may still be running after cleanup attempts"
      );
    }
  } catch (error) {
    if (error instanceof ScraperError && error.code === "MULTILOGIN") {
      console.error("Multilogin cleanup skipped:", error.message);
      return;
    }
    throw error;
  }
}

export async function verifyMultiloginToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${MLX_API}/user/workspaces`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
