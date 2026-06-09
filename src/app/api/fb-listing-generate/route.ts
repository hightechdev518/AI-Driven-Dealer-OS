import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateFbListing } from "@/lib/fb-scraper/listing-ai";

export async function POST(request: Request) {
  try {
    const { vehicle_id } = await request.json();

    if (!vehicle_id) {
      return NextResponse.json(
        { error: "vehicle_id is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: vehicle, error } = await supabase
      .from("vehicles")
      .select("year, make, model, mileage, retail_price, notes")
      .eq("id", vehicle_id)
      .single();

    if (error || !vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const listing = await generateFbListing(vehicle);

    return NextResponse.json({
      title: listing.title,
      description: listing.description,
      price: vehicle.retail_price,
      category: "vehicles",
    });
  } catch (error) {
    console.error("POST /api/fb-listing-generate:", error);
    return NextResponse.json(
      { error: "Failed to generate listing content" },
      { status: 500 }
    );
  }
}
