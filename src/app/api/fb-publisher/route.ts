import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ScraperError } from "@/lib/fb-scraper/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface PublishRequestBody {
  vehicle_id: string;
  title: string;
  description: string;
  price: number;
  photos: string[];
  location: string;
  category?: string;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  let vehicleId: string | undefined;

  try {
    const body = (await request.json()) as PublishRequestBody;
    vehicleId = body.vehicle_id;

    if (!vehicleId || !body.title || !body.description || !body.price) {
      return NextResponse.json(
        { error: "vehicle_id, title, description, and price are required" },
        { status: 400 }
      );
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, year, make, model, mileage, retail_price")
      .eq("id", vehicleId)
      .single();

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    await supabase
      .from("vehicles")
      .update({ fb_listing_status: "draft" })
      .eq("id", vehicleId);

    const { publishToFacebookMarketplace } = await import(
      "@/lib/fb-scraper/publisher"
    );

    const result = await publishToFacebookMarketplace({
      vehicleId,
      title: body.title,
      description: body.description,
      price: body.price,
      photos: Array.isArray(body.photos) ? body.photos : [],
      location: body.location ?? "",
      category: body.category ?? "vehicles",
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      mileage: vehicle.mileage,
    });

    const primaryPhoto = Array.isArray(body.photos)
      ? body.photos.find((url) => typeof url === "string" && url.trim())
      : undefined;

    const { data: updated, error: updateError } = await supabase
      .from("vehicles")
      .update({
        fb_listing_url: result.listingUrl,
        fb_listed_at: new Date().toISOString(),
        fb_listing_status: "published",
        listed_online: true,
        online_channel: "Facebook Marketplace",
        ...(primaryPhoto ? { image_url: primaryPhoto.trim() } : {}),
      })
      .eq("id", vehicleId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      listing_url: result.listingUrl,
      photos_uploaded: result.photosUploaded,
      vehicle: updated,
    });
  } catch (error) {
    console.error("POST /api/fb-publisher:", error);

    if (vehicleId) {
      await supabase
        .from("vehicles")
        .update({ fb_listing_status: "draft" })
        .eq("id", vehicleId)
        .then(({ error: draftError }) => {
          if (draftError) console.error("Failed to save draft status:", draftError);
        });
    }

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
        { error: error.message, code: error.code },
        { status: statusMap[error.code] ?? 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to publish to Facebook Marketplace" },
      { status: 500 }
    );
  }
}
