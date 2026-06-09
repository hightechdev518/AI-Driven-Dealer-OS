import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  fetchConversationMessages,
  fetchConversations,
  getCustomerParticipant,
  GraphApiError,
} from "@/lib/messenger/graph-api";

export async function POST() {
  try {
    const pageId = process.env.FB_PAGE_ID;
    if (!pageId) {
      return NextResponse.json(
        { error: "FB_PAGE_ID is not configured" },
        { status: 500 }
      );
    }

    const supabase = createServerClient();
    const conversations = await fetchConversations();

    let newCustomers = 0;
    let newMessages = 0;
    let updatedConversations = 0;

    for (const conversation of conversations) {
      const participant = getCustomerParticipant(conversation, pageId);
      if (!participant?.id) continue;

      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("fb_messenger_id", participant.id)
        .maybeSingle();

      let customerId = existingCustomer?.id;

      if (!customerId) {
        const { data: created, error: createError } = await supabase
          .from("customers")
          .insert({
            name: participant.name ?? "Facebook User",
            email: participant.email ?? null,
            fb_messenger_id: participant.id,
            fb_conversation_id: conversation.id,
            fb_profile_url: conversation.link ?? null,
            source: "messenger",
          })
          .select("id")
          .single();

        if (createError) {
          console.error("Customer insert error:", createError);
          continue;
        }

        customerId = created.id;
        newCustomers++;
      } else {
        await supabase
          .from("customers")
          .update({
            name: participant.name ?? undefined,
            fb_conversation_id: conversation.id,
            fb_profile_url: conversation.link ?? undefined,
          })
          .eq("id", customerId);
        updatedConversations++;
      }

      const fbMessages = await fetchConversationMessages(conversation.id);

      for (const fbMsg of fbMessages) {
        if (!fbMsg.message) continue;

        const { data: existingMsg } = await supabase
          .from("messages")
          .select("id")
          .eq("fb_message_id", fbMsg.id)
          .maybeSingle();

        if (existingMsg) continue;

        const direction =
          fbMsg.from.id === pageId ? "outbound" : "inbound";

        const { error: msgError } = await supabase.from("messages").insert({
          customer_id: customerId,
          message: fbMsg.message,
          direction,
          timestamp: fbMsg.created_time,
          read: direction === "outbound",
          fb_message_id: fbMsg.id,
        });

        if (!msgError) newMessages++;
      }
    }

    return NextResponse.json({
      success: true,
      conversations_synced: conversations.length,
      new_customers: newCustomers,
      new_messages: newMessages,
      updated_conversations: updatedConversations,
    });
  } catch (error) {
    console.error("POST /api/messenger/sync:", error);

    if (error instanceof GraphApiError) {
      return NextResponse.json(
        {
          error: error.tokenExpired
            ? "Facebook access token expired. Generate a new Page Access Token in Meta Business Suite and update FB_PAGE_ACCESS_TOKEN."
            : error.message,
          token_expired: error.tokenExpired,
        },
        { status: error.tokenExpired ? 401 : 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to sync Messenger conversations" },
      { status: 500 }
    );
  }
}
