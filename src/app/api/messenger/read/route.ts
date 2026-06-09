import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { customer_id } = await request.json();

    if (!customer_id) {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("messages")
      .update({ read: true })
      .eq("customer_id", customer_id)
      .eq("direction", "inbound")
      .eq("read", false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/messenger/read:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
