import { NextResponse } from "next/server";
import { ScraperError } from "@/lib/fb-scraper/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const {
      forceStopMultiloginSession,
      getMultiloginConfig,
      isProfileRunning,
    } = await import("@/lib/fb-scraper/multilogin");

    const config = await getMultiloginConfig();
    const wasRunning = await isProfileRunning(config);
    const result = await forceStopMultiloginSession(config);
    const stillRunning = await isProfileRunning(config);

    if (!result.stopped || stillRunning) {
      return NextResponse.json(
        {
          success: false,
          wasRunning,
          stillRunning,
          error:
            "Could not stop the browser profile. Try again, or restart the Multilogin launcher on the server.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      wasRunning,
      stillRunning: false,
      message: wasRunning
        ? "Browser profile stopped. Port 45000 is the Multilogin launcher and should stay running — you can search again now."
        : "No browser profile was running. You can search again now.",
    });
  } catch (error) {
    console.error("POST /api/fb-scraper/reset-session:", error);

    if (error instanceof ScraperError) {
      const statusMap: Record<ScraperError["code"], number> = {
        CONFIG: 500,
        LOGIN: 401,
        TWO_FACTOR: 403,
        BLOCKED: 429,
        MULTILOGIN: 502,
        SCRAPE: 500,
        PUBLISH: 500,
      };

      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: statusMap[error.code] ?? 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset Multilogin session",
      },
      { status: 500 }
    );
  }
}
