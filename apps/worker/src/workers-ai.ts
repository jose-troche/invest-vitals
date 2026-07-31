import type { AssistantAnswer, Company } from "@invest-vitals/domain";

export const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

export interface WorkersAiClient {
  run(
    model: typeof AI_MODEL,
    inputs: {
      messages: Array<{ role: string; content: string }>;
      max_tokens: number;
      temperature: number;
      response_format: { type: string; json_schema: unknown };
    },
    options?: { tags?: string[] },
  ): Promise<{ response?: unknown }>;
}

const assistantSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "highlights", "followUps"],
  properties: {
    answer: { type: "string", minLength: 20, maxLength: 1500 },
    highlights: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value"],
        properties: {
          label: { type: "string", minLength: 1, maxLength: 80 },
          value: { type: "string", minLength: 1, maxLength: 180 },
        },
      },
    },
    followUps: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 3, maxLength: 120 } },
  },
} as const;

function evidencePacket(companies: Company[]) {
  return companies.map((company) => ({
    symbol: company.symbol,
    name: company.name,
    marketAsOf: company.marketData?.asOf,
    health: company.health,
    healthLabel: company.healthLabel,
    momentum: company.momentum,
    momentumScore: company.momentumScore,
    dayChangePct: company.dayChangePct,
    keyChange: company.keyChange,
    fundamentalsProvenance: company.evidence?.fundamentals?.provenance ?? { source: "Invest Vitals baseline dataset", status: "fallback" },
    fundamentals: company.fundamentals.map(({ label, value, status, context }) => ({ label, value, status, context })),
    valuation: company.valuation.map(({ label, value, status }) => ({ label, value, status })),
    thesisStatus: company.thesisStatus,
    risks: company.risks,
    latestEarnings: company.evidence?.earnings.slice(0, 2),
    recentFilings: company.evidence?.filings.slice(0, 3).map(({ form, filedAt, reportDate, url }) => ({ form, filedAt, reportDate, url })),
    recentNews: company.evidence?.news.slice(0, 3).map(({ title, source, publishedAt, summary }) => ({ title, source, publishedAt, summary })),
  }));
}

function parseJsonResponse(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

export function validateAssistantAnswer(value: unknown): AssistantAnswer | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.answer !== "string" || record.answer.length < 20 || record.answer.length > 1500) return undefined;
  if (/\b(you should|i recommend|you must)\s+(buy|sell)\b/i.test(record.answer)) return undefined;
  if (!Array.isArray(record.highlights) || record.highlights.length < 1 || record.highlights.length > 4) return undefined;
  const highlights = record.highlights.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const highlight = item as Record<string, unknown>;
    if (typeof highlight.label !== "string" || typeof highlight.value !== "string") return [];
    if (highlight.label.length < 1 || highlight.label.length > 80 || highlight.value.length < 1 || highlight.value.length > 180) return [];
    return [{ label: highlight.label, value: highlight.value }];
  });
  if (highlights.length !== record.highlights.length) return undefined;
  if (!Array.isArray(record.followUps) || record.followUps.length < 1 || record.followUps.length > 4 || !record.followUps.every((item) => typeof item === "string" && item.length >= 3 && item.length <= 120)) return undefined;
  return { answer: record.answer, highlights, followUps: record.followUps as string[], mode: "ai" };
}

export async function answerWithWorkersAi(ai: WorkersAiClient, question: string, companies: Company[], fallback: AssistantAnswer): Promise<AssistantAnswer> {
  const evidenceAsOf = companies.map((company) => company.marketData?.asOf).filter((value): value is string => Boolean(value)).sort().at(-1) ?? new Date().toISOString();
  const requiresBaselineDisclosure = companies.some((company) => !company.evidence?.fundamentals);
  try {
    const result = await ai.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content: "You are Invest Vitals, an evidence-first long-term investing assistant. Use only the supplied normalized evidence. Distinguish market data from baseline data. If any used figure has baseline provenance, explicitly call it baseline in the answer. Never predict prices or issue buy/sell instructions. If evidence is absent or stale, say so. Return only JSON matching the schema.",
        },
        { role: "user", content: JSON.stringify({ question, evidence: evidencePacket(companies) }) },
      ],
      max_tokens: 520,
      temperature: 0.1,
      response_format: { type: "json_schema", json_schema: assistantSchema },
    }, { tags: ["invest-vitals", "assistant"] });
    const responseValue = typeof result.response === "string" ? parseJsonResponse(result.response) : result.response;
    const parsed = responseValue ? validateAssistantAnswer(responseValue) : undefined;
    if (!parsed) throw new Error("Workers AI response failed schema validation");
    if (requiresBaselineDisclosure && !/\bbaseline\b/i.test(parsed.answer)) throw new Error("Workers AI response omitted baseline disclosure");
    return { ...parsed, evidenceAsOf };
  } catch (error) {
    console.warn(JSON.stringify({ event: "workers_ai_fallback", model: AI_MODEL, error: String(error) }));
    return { ...fallback, mode: "deterministic", evidenceAsOf };
  }
}
