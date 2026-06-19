const KIE_API_URL = "https://api.kie.ai/v1/chat/completions";

export type KieMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type KieChatOptions = {
  model?: string;
  messages: KieMessage[];
  response_format?: { type: "json_object" };
  temperature?: number;
};

export async function kieChatCompletion(options: KieChatOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch(KIE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? "gpt-4o",
      messages: options.messages,
      ...(options.response_format && {
        response_format: options.response_format,
      }),
      ...(options.temperature != null && { temperature: options.temperature }),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Kie.ai API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No response from Kie.ai");
  }

  return content;
}
