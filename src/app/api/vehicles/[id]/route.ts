import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enrichVehicle, enrichVehicleRecord } from "@/lib/vehicle-logic";
import type { VehicleFormData } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;

    return NextResponse.json(enrichVehicleRecord(data));
  } catch (error) {
    console.error("GET /api/vehicles/[id]:", error);
    return NextResponse.json(
      { error: "Vehicle not found" },
      { status: 404 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body: VehicleFormData = await request.json();
    const enriched = enrichVehicle({ ...body, id: params.id });

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .update(enriched)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(enrichVehicleRecord(data));
  } catch (error) {
    console.error("PATCH /api/vehicles/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/vehicles/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete vehicle" },
      { status: 500 }
    );
  }
}
