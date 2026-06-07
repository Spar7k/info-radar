/**
 * Minimal OpenAI-compatible chat completions client.
 */

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  jsonMode: boolean;
}

export interface LlmChatResult {
  content: string;
  finishReason?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadLlmConfig(): LlmConfig | null {
  const apiKey = process.env["INFO_RADAR_LLM_API_KEY"]?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: (process.env["INFO_RADAR_LLM_BASE_URL"] ?? "https://api.openai.com/v1").trim(),
    model: (process.env["INFO_RADAR_LLM_MODEL"] ?? "gpt-4o-mini").trim(),
    maxTokens: envInt("INFO_RADAR_LLM_MAX_TOKENS", 4096),
    jsonMode: (process.env["INFO_RADAR_LLM_JSON_MODE"] ?? "true").trim().toLowerCase() !== "false",
  };
}

// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: { content: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export class LlmClient {
  constructor(private readonly config: LlmConfig) {}

  async chat(
    messages: ChatMessage[],
    options: { temperature?: number } = {},
  ): Promise<LlmChatResult> {
    const { temperature = 0.3 } = options;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature,
      max_tokens: this.config.maxTokens,
    };

    if (this.config.jsonMode) {
      body["response_format"] = { type: "json_object" };
    }

    const resp = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "(unable to read body)");
      throw new Error(`LLM API error HTTP ${resp.status}: ${bodyText.slice(0, 500)}`);
    }

    const data = (await resp.json()) as ChatCompletionResponse;
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (!content) throw new Error("LLM returned empty response");

    return {
      content,
      finishReason: choice?.finish_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
