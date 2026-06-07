/**
 * Minimal OpenAI-compatible chat completions client.
 *
 * Reads configuration from environment variables only — nothing hard-coded.
 * Fails gracefully when no API key is set.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** Reads LLM config from env. Returns null when no API key is set. */
export function loadLlmConfig(): LlmConfig | null {
  const apiKey = process.env["INFO_RADAR_LLM_API_KEY"]?.trim();
  if (!apiKey) return null;

  const baseUrl = (process.env["INFO_RADAR_LLM_BASE_URL"] ?? "https://api.openai.com/v1").trim();
  const model = (process.env["INFO_RADAR_LLM_MODEL"] ?? "gpt-4o-mini").trim();

  return { apiKey, baseUrl, model };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

export class LlmClient {
  constructor(private readonly config: LlmConfig) {}

  async chat(
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    const { temperature = 0.3, maxTokens = 4096 } = options;

    const resp = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "(unable to read body)");
      throw new Error(`LLM API error HTTP ${resp.status}: ${body.slice(0, 500)}`);
    }

    const data = (await resp.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty response");

    return content;
  }
}
