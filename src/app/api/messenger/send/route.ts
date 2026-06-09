import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendMessengerMessage, GraphApiError } from "@/lib/messenger/graph-api";

export async function POST(request: Request) {
  try {
    const { customer_id, message } = await request.json();

    if (!customer_id || !message?.trim()) {
      return NextResponse.json(
        { error: "customer_id and message are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, fb_messenger_id, name")
      .eq("id", customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (!customer.fb_messenger_id) {
      return NextResponse.json(
        { error: "Customer has no Facebook Messenger ID" },
        { status: 400 }
      );
    }

    const result = await sendMessengerMessage(
      customer.fb_messenger_id,
      message.trim()
    );

    const timestamp = new Date().toISOString();
    const { data: savedMessage, error: saveError } = await supabase
      .from("messages")
      .insert({
        customer_id,
        message: message.trim(),
        direction: "outbound",
        timestamp,
        read: true,
        fb_message_id: result.message_id ?? null,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return NextResponse.json({ success: true, message: savedMessage });
  } catch (error) {
    console.error("POST /api/messenger/send:", error);

    if (error instanceof GraphApiError) {
      return NextResponse.json(
        {
          error: error.tokenExpired
            ? "Facebook access token expired. Refresh FB_PAGE_ACCESS_TOKEN in your environment."
            : error.message,
          token_expired: error.tokenExpired,
        },
        { status: error.tokenExpired ? 401 : 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
