import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enrichVehicle, enrichVehicleRecord } from "@/lib/vehicle-logic";
import type { VehicleFormData } from "@/lib/types";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const vehicles = (data ?? []).map(enrichVehicleRecord);
    return NextResponse.json(vehicles);
  } catch (error) {
    console.error("GET /api/vehicles:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: VehicleFormData = await request.json();
    const enriched = enrichVehicle(body);

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .insert(enriched)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(enrichVehicleRecord(data), { status: 201 });
  } catch (error) {
    console.error("POST /api/vehicles:", error);
    return NextResponse.json(
      { error: "Failed to create vehicle" },
      { status: 500 }
    );
  }
}
