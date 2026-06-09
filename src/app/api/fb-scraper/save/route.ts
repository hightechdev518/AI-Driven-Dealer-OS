import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { FbListing } from "@/lib/fb-scraper/types";

export const runtime = "nodejs";

interface SaveRequestBody {
  vehicle_id?: string;
  results: FbListing[];
}

async function updateVehicleStats(vehicleId: string) {
  const supabase = createServerClient();
  const { data: comps } = await supabase
    .from("market_comps")
    .select("listing_price")
    .eq("vehicle_id", vehicleId);

  if (!comps || comps.length === 0) return;

  const prices = comps
    .map((c) => c.listing_price)
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b);

  if (prices.length === 0) return;

  await supabase
    .from("vehicles")
    .update({
      comp_count: prices.length,
      market_low: prices[0],
      market_high: prices[prices.length - 1],
      market_avg: Math.round(
        prices.reduce((sum, p) => sum + p, 0) / prices.length
      ),
    })
    .eq("id", vehicleId);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveRequestBody;
    const { vehicle_id, results } = body;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "No results provided to save" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const today = new Date().toISOString().split("T")[0];

    const rows = results.map((item) => ({
      vehicle_id: vehicle_id ?? null,
      year: item.year,
      make: item.make,
      model: item.model,
      mileage: item.mileage,
      source: "Facebook Marketplace",
      location: item.location,
      listing_price: item.price,
      url: item.url,
      source_notes: item.daysListed != null
        ? `Listed ${item.daysListed} day${item.daysListed === 1 ? "" : "s"} ago`
        : item.title,
      date_checked: today,
    }));

    const { data, error } = await supabase
      .from("market_comps")
      .insert(rows)
      .select();

    if (error) throw error;

    if (vehicle_id) {
      await updateVehicleStats(vehicle_id);
    }

    return NextResponse.json(
      {
        saved: data?.length ?? 0,
        comps: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/fb-scraper/save:", error);
    return NextResponse.json(
      { error: "Failed to save market comps" },
      { status: 500 }
    );
  }
}
