import { createHash } from "crypto";
import https from "https";
import { ScraperError } from "./types";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const MLX_API = "https://api.multilogin.com";
const MLX_LAUNCHER = "https://127.0.0.1:45001";

function httpsGet(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: "GET",
      rejectUnauthorized: false,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    };
    const req = https.request(options, (res) => {
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

export async function startMultiloginProfile(
  config: MultiloginConfig
): Promise<string> {
  const url = `${MLX_LAUNCHER}/api/v2/profile/f/${config.folderId}/p/${config.profileId}/start?automation_type=playwright&headless_mode=false`;

  let body: { data?: { port?: number } } = {};
  try {
    const raw = await httpsGet(url, config.apiToken);
    body = JSON.parse(raw);
  } catch (error) {
    console.error("Multilogin start profile failed:", error);
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

  return `http://127.0.0.1:${port}`;
}

export async function stopMultiloginProfile(
  config: MultiloginConfig
): Promise<void> {
  const url = `${MLX_LAUNCHER}/api/v2/profile/stop/p/${config.profileId}`;

  try {
    await httpsGet(url, config.apiToken);
  } catch (error) {
    console.error("Multilogin stop profile error:", error);
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
