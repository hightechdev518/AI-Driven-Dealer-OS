import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { ConversationSummary, Customer, Message } from "@/lib/types";

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: customers, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const summaries: ConversationSummary[] = [];

    for (const customer of (customers ?? []) as Customer[]) {
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("customer_id", customer.id)
        .order("timestamp", { ascending: false });

      const msgs = (messages ?? []) as Message[];
      const lastMsg = msgs[0];
      const unreadCount = msgs.filter(
        (m) => m.direction === "inbound" && !m.read
      ).length;

      summaries.push({
        customer,
        last_message: lastMsg?.message ?? null,
        last_message_at: lastMsg?.timestamp ?? null,
        unread_count: unreadCount,
      });
    }

    summaries.sort((a, b) => {
      const aTime = a.last_message_at
        ? new Date(a.last_message_at).getTime()
        : 0;
      const bTime = b.last_message_at
        ? new Date(b.last_message_at).getTime()
        : 0;
      return bTime - aTime;
    });

    return NextResponse.json(summaries);
  } catch (error) {
    console.error("GET /api/messenger/conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
