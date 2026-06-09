import OpenAI from "openai";
import type { Vehicle } from "@/lib/types";

export interface GeneratedListing {
  title: string;
  description: string;
}

function buildListingPrompt(vehicle: Pick<
  Vehicle,
  "year" | "make" | "model" | "mileage" | "retail_price" | "notes"
>): string {
  return `Generate a Facebook Marketplace listing for this vehicle:
Year: ${vehicle.year ?? "Unknown"}
Make: ${vehicle.make ?? "Unknown"}
Model: ${vehicle.model ?? "Unknown"}
Mileage: ${vehicle.mileage ?? "Unknown"}
Price: ${vehicle.retail_price ?? "Unknown"}
Notes: ${vehicle.notes ?? "None"}

Write a compelling title (max 100 chars) and description (max 500 chars) that a used car dealer would write.
Be honest, highlight key features, mention mileage and price.
Return JSON: {"title": string, "description": string}`;
}

export function fallbackListing(
  vehicle: Pick<
    Vehicle,
    "year" | "make" | "model" | "mileage" | "retail_price" | "notes"
  >
): GeneratedListing {
  const mileageStr = vehicle.mileage
    ? `${vehicle.mileage.toLocaleString()} miles`
    : "low miles";
  const priceStr = vehicle.retail_price
    ? `$${vehicle.retail_price.toLocaleString()}`
    : "Contact for price";

  const title = [vehicle.year, vehicle.make, vehicle.model, mileageStr, priceStr]
    .filter(Boolean)
    .join(" - ")
    .slice(0, 100);

  const description = [
    `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim(),
    `Mileage: ${mileageStr}. Asking ${priceStr}.`,
    vehicle.notes ? vehicle.notes : "Well-maintained vehicle from 23 Motorsports.",
    "Message us on Marketplace to schedule a viewing. Clean title, ready to drive.",
  ]
    .join(" ")
    .slice(0, 500);

  return { title, description };
}

export async function generateFbListing(
  vehicle: Pick<
    Vehicle,
    "year" | "make" | "model" | "mileage" | "retail_price" | "notes"
  >
): Promise<GeneratedListing> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackListing(vehicle);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You write Facebook Marketplace vehicle listings for an independent used car dealer. Return only valid JSON.",
      },
      { role: "user", content: buildListingPrompt(vehicle) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return fallbackListing(vehicle);

  const parsed = JSON.parse(content) as GeneratedListing;
  return {
    title: (parsed.title ?? fallbackListing(vehicle).title).slice(0, 100),
    description: (parsed.description ?? fallbackListing(vehicle).description).slice(
      0,
      500
    ),
  };
}
