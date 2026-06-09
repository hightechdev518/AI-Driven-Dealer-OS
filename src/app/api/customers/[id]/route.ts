import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", params.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("customer_id", params.id)
      .order("timestamp", { ascending: true });

    const { data: inquiries } = await supabase
      .from("customer_inquiries")
      .select("*, vehicles(id, year, make, model, retail_price, status)")
      .eq("customer_id", params.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      customer,
      messages: messages ?? [],
      inquiries: inquiries ?? [],
    });
  } catch (error) {
    console.error("GET /api/customers/[id]:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("customers")
      .update({
        name: body.name,
        phone: body.phone,
        email: body.email,
        notes: body.notes,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/customers/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}
