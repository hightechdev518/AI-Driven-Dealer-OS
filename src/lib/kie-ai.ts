const KIE_API_BASE = "https://api.kie.ai";

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

function getModelSlugs(model: string): string[] {
  if (model === "gpt-4o") {
    return ["gpt-4o", "gpt-5-2"];
  }
  return [model];
}

function getEndpointCandidates(modelSlug: string): string[] {
  const customBase = process.env.KIE_API_URL?.replace(/\/$/, "");
  const endpoints = [
    `${KIE_API_BASE}/api/v1/${modelSlug}/v1/chat/completions`,
    `${KIE_API_BASE}/${modelSlug}/v1/chat/completions`,
    `${KIE_API_BASE}/api/v1/chat/completions`,
    `${KIE_API_BASE}/v1/chat/completions`,
    "https://kie.ai/api/v1/chat/completions",
  ];

  if (customBase) {
    endpoints.unshift(`${customBase}/${modelSlug}/v1/chat/completions`);
    endpoints.unshift(`${customBase}/v1/chat/completions`);
  }

  return endpoints;
}

function extractContent(data: unknown): string | null {
  const payload = data as {
    code?: number;
    msg?: string;
    choices?: Array<{ message?: { content?: string | null } }>;
    data?: {
      choices?: Array<{ message?: { content?: string | null } }>;
      content?: string;
    };
  };

  if (payload.code != null && payload.code !== 200) {
    throw new Error(payload.msg || `Kie.ai API error code ${payload.code}`);
  }

  const openAiContent = payload.choices?.[0]?.message?.content;
  if (openAiContent) return openAiContent;

  const nestedContent = payload.data?.choices?.[0]?.message?.content;
  if (nestedContent) return nestedContent;

  if (typeof payload.data?.content === "string") {
    return payload.data.content;
  }

  return null;
}

export async function kieChatCompletion(options: KieChatOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const model = options.model ?? "gpt-4o";
  const slugs = getModelSlugs(model);
  const errors: string[] = [];

  for (const slug of slugs) {
    const endpoints = getEndpointCandidates(slug);

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: slug,
            messages: options.messages,
            ...(options.response_format && {
              response_format: options.response_format,
            }),
            ...(options.temperature != null && {
              temperature: options.temperature,
            }),
          }),
        });

        if (response.status === 404) {
          errors.push(`${url}: 404`);
          continue;
        }

        const data = await response.json();

        if (!response.ok) {
          const message =
            (data as { msg?: string; error?: { message?: string } }).msg ||
            (data as { error?: { message?: string } }).error?.message ||
            response.statusText;
          errors.push(`${url}: ${response.status} ${message}`);
          continue;
        }

        const content = extractContent(data);
        if (!content) {
          errors.push(`${url}: empty response`);
          continue;
        }

        console.log(`Kie.ai success via ${url} (model: ${slug})`);
        return content;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`${url}: ${message}`);
      }
    }
  }

  throw new Error(
    `Kie.ai API failed on all endpoints. Attempts:\n${errors.join("\n")}`
  );
}
