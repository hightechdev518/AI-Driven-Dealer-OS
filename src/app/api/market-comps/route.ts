import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicle_id");

    const supabase = createServerClient();
    let query = supabase
      .from("market_comps")
      .select("*")
      .order("date_checked", { ascending: false });

    if (vehicleId) {
      query = query.eq("vehicle_id", vehicleId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/market-comps:", error);
    return NextResponse.json(
      { error: "Failed to fetch market comps" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("market_comps")
      .insert({
        vehicle_id: body.vehicle_id,
        year: body.year,
        make: body.make,
        model: body.model,
        mileage: body.mileage,
        source: body.source,
        location: body.location,
        listing_price: body.listing_price,
        url: body.url,
        source_notes: body.source_notes,
        date_checked: body.date_checked || new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) throw error;

    // Update comp_count and market stats on vehicle
    const { data: comps } = await supabase
      .from("market_comps")
      .select("listing_price")
      .eq("vehicle_id", body.vehicle_id);

    if (comps && comps.length > 0) {
      const prices = comps
        .map((c) => c.listing_price)
        .filter((p): p is number => p != null)
        .sort((a, b) => a - b);

      if (prices.length > 0) {
        const marketLow = prices[0];
        const marketHigh = prices[prices.length - 1];
        const marketAvg = Math.round(
          prices.reduce((sum, p) => sum + p, 0) / prices.length
        );

        await supabase
          .from("vehicles")
          .update({
            comp_count: prices.length,
            market_low: marketLow,
            market_avg: marketAvg,
            market_high: marketHigh,
          })
          .eq("id", body.vehicle_id);
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/market-comps:", error);
    return NextResponse.json(
      { error: "Failed to create market comp" },
      { status: 500 }
    );
  }
}
