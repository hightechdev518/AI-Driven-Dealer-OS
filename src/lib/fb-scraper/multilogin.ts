import { ScraperError } from "./types";

const MLX_API = "https://api.multilogin.com";
const MLX_LAUNCHER = "http://127.0.0.1:45001";

export interface MultiloginConfig {
  apiToken: string;
  folderId: string;
  profileId: string;
}

export function getMultiloginConfig(): MultiloginConfig {
  const apiToken = process.env.MULTILOGIN_API_TOKEN;
  const folderId = process.env.MULTILOGIN_FOLDER_ID;
  const profileId = process.env.MULTILOGIN_PROFILE_ID;

  if (!apiToken || !profileId) {
    throw new ScraperError(
      "Missing MULTILOGIN_API_TOKEN or MULTILOGIN_PROFILE_ID in environment",
      "CONFIG"
    );
  }

  if (!folderId) {
    throw new ScraperError(
      "Missing MULTILOGIN_FOLDER_ID in environment (required to launch profile)",
      "CONFIG"
    );
  }

  return { apiToken, folderId, profileId };
}

export async function startMultiloginProfile(
  config: MultiloginConfig
): Promise<string> {
  const url = `${MLX_LAUNCHER}/api/v2/profile/f/${config.folderId}/p/${config.profileId}/start?automation_type=playwright&headless_mode=false`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      Accept: "application/json",
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Multilogin start profile failed:", body);
    throw new ScraperError(
      `Failed to start Multilogin profile: ${JSON.stringify(body)}`,
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
    await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Accept: "application/json",
      },
    });
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
