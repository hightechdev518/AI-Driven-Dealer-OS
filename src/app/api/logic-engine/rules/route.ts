import { NextResponse } from "next/server";
import OpenAI from "openai";
import { DEFAULT_LOGIC_RULES } from "@/lib/logic-engine/default-rules";
import { loadAllRules, saveCustomRule } from "@/lib/logic-engine/storage";
import type { LogicRule } from "@/lib/logic-engine/types";

export async function GET() {
  try {
    const rules = await loadAllRules(DEFAULT_LOGIC_RULES);
    return NextResponse.json(rules);
  } catch (error) {
    console.error("GET /api/logic-engine/rules:", error);
    return NextResponse.json(
      { error: "Failed to load rules" },
      { status: 500 }
    );
  }
}

const SYSTEM_PROMPT = `You convert dealer inventory rules from plain English into structured JSON.

Return a JSON object with these fields:
- name (string): short rule name
- summary (string): one-line human-readable rule
- condition (string): the IF condition in plain English
- action (string): the THEN action in plain English
- category: one of "inventory", "pricing", "leads", "acquisition"
- match: object with optional numeric/boolean fields:
  minDaysInStock, maxDaysInStock, minProfit, maxProfit,
  minLeads, maxLeads, minCompCount, maxCompCount,
  minLeadAgeMinutes, requireListed
- output: object with:
  ai_priority: one of "LIST NOW", "HOLD", "PRICE DROP", "AUCTION", "MONEY TRAP", "URGENT", "BUY", "PASS"
  action_required: string describing what the dealer should do
  priceAdjustPercent: optional number (e.g. -5 for 5% drop, 3 for 3% increase)

Only return valid JSON, no markdown.`;

export async function POST(request: Request) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Rule description is required" },
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

    const parsed = JSON.parse(content) as Omit<
      LogicRule,
      "id" | "active" | "builtIn" | "createdAt"
    >;

    const rule: LogicRule = {
      id: `custom-${Date.now()}`,
      name: parsed.name ?? "Custom Rule",
      summary: parsed.summary ?? description,
      condition: parsed.condition ?? description,
      action: parsed.action ?? "Apply custom rule",
      category: parsed.category ?? "inventory",
      active: true,
      builtIn: false,
      match: parsed.match,
      output: parsed.output,
      createdAt: new Date().toISOString(),
    };

    await saveCustomRule(rule);

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("POST /api/logic-engine/rules:", error);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}
