import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enrichVehicle, enrichVehicleRecord } from "@/lib/vehicle-logic";
import {
  attachStoredImageUrl,
  getStoredVehicleImageUrl,
} from "@/lib/vehicle-image-store";
import {
  extractImageUrl,
  saveVehicleWithOptionalImage,
} from "@/lib/vehicle-persistence";
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

    const storedImageUrl = await getStoredVehicleImageUrl(params.id);
    const withImage = attachStoredImageUrl(data, storedImageUrl);

    return NextResponse.json(enrichVehicleRecord(withImage));
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
    const imageUrl = extractImageUrl(body);
    const enriched = enrichVehicle({ ...body, id: params.id });

    const supabase = createServerClient();
    const { data, error } = await saveVehicleWithOptionalImage({
      vehicleId: params.id,
      enriched,
      imageUrl,
      save: async (payload) =>
        supabase
          .from("vehicles")
          .update(payload)
          .eq("id", params.id)
          .select()
          .single(),
    });

    if (error) throw error;
    if (!data) throw new Error("Vehicle not found");

    const storedImageUrl = await getStoredVehicleImageUrl(params.id);
    const withImage = attachStoredImageUrl(data, storedImageUrl);

    return NextResponse.json(enrichVehicleRecord(withImage));
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
