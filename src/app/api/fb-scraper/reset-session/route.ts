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

    if (!result.stopped) {
      return NextResponse.json(
        {
          success: false,
          wasRunning,
          error:
            "Could not confirm the browser session stopped. Try again or restart Multilogin on the server.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      wasRunning,
      message: wasRunning
        ? "Browser session stopped. You can search again."
        : "No active browser session was running.",
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
