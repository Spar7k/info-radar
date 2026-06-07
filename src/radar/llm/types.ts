/**
 * LLM-related types for Task 4 enrichment.
 */

/** Per-item LLM enrichment — keyed by the item's id. */
export interface LlmItemEnrichment {
  id: string;
  llmSummary: string;
  llmRecommendationReason: string;
  llmRiskNote: string;
}

/** LLM-generated daily report. */
export interface LlmReportEnrichment {
  summary: string;
  markdown: string;
}

/** Expected LLM response shape. */
export interface LlmResponse {
  items?: LlmItemEnrichment[];
  report?: LlmReportEnrichment;
}

/** Metadata written to the output _meta.llm block. */
export interface LlmMeta {
  status: "skipped_no_api_key" | "ok" | "failed";
  model: string;
  baseUrlConfigured: boolean;
  itemCount: number;
  errorMessage?: string;
}
