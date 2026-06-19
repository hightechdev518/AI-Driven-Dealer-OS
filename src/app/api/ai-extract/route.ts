import { NextResponse } from "next/server";
import { kieChatCompletion } from "@/lib/kie-ai";
import type { AiExtractedVehicle } from "@/lib/types";

const SYSTEM_PROMPT = `You are an assistant for an independent car dealership. Extract vehicle information from natural language descriptions.

Return a JSON object with these fields:
- year (number or null)
- make (string or null)
- model (string or null)
- mileage (number or null)
- my_cost (number or null) - the purchase/acquisition cost
- repair_cost (number or null) - any repair costs mentioned
- retail_price (number or null) - asking/retail price if mentioned
- notes (string or null) - any additional relevant details
- online_channel (string or null) - where it's listed (Facebook, Craigslist, etc.)

Only return valid JSON, no markdown or explanation.`;

export async function POST(request: Request) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const content = await kieChatCompletion({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const extracted: AiExtractedVehicle = JSON.parse(content);

    return NextResponse.json(extracted);
  } catch (error) {
    console.error("POST /api/ai-extract:", error);
    return NextResponse.json(
      { error: "Failed to extract vehicle data" },
      { status: 500 }
    );
  }
}
