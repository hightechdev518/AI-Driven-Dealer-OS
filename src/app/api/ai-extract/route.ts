import { NextResponse } from "next/server";
import OpenAI from "openai";
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
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

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
