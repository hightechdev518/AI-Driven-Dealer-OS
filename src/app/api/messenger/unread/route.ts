import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();

    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "inbound")
      .eq("read", false);

    if (error) throw error;

    return NextResponse.json({ unread_count: count ?? 0 });
  } catch (error) {
    console.error("GET /api/messenger/unread:", error);
    return NextResponse.json({ unread_count: 0 });
  }
}
