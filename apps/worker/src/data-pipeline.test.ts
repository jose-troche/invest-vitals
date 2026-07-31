import { companies, type CompanyEvidence } from "@invest-vitals/domain";
import { describe, expect, it } from "vitest";
import { applyEvidence } from "./evidence-enrichment";
import { loadCompanyEvidence, type CompanyEvidenceProvider } from "./evidence-provider";
import { detectMaterialTransitions } from "./persistence";
import { answerWithWorkersAi, validateAssistantAnswer, type WorkersAiClient } from "./workers-ai";

const evidence: CompanyEvidence = {
  symbol: "MSFT",
  fundamentals: {
    symbol: "MSFT",
    fiscalPeriod: "2026-06-30",
    revenueGrowthPct: 22,
    epsGrowthPct: 25,
    operatingMarginPct: 46,
    grossMarginPct: 70,
    provenance: { source: "Test provider", asOf: "2026-06-30", fetchedAt: "2026-07-31T20:00:00Z", status: "live" },
  },
  earnings: [{
    symbol: "MSFT",
    fiscalDateEnding: "2026-06-30",
    reportedEps: 4.2,
    estimatedEps: 4,
    surprisePct: 5,
    provenance: { source: "Test provider", asOf: "2026-07-30", fetchedAt: "2026-07-31T20:00:00Z", status: "live" },
  }],
  filings: [],
  news: [],
};

describe("normalized evidence pipeline", () => {
  it("merges partial providers and keeps a failed provider non-fatal", async () => {
    const providers: CompanyEvidenceProvider[] = [
      { name: "fundamentals", load: async () => ({ symbol: "MSFT", fundamentals: evidence.fundamentals }) },
      { name: "earnings", load: async () => ({ symbol: "MSFT", earnings: evidence.earnings }) },
      { name: "failed", load: async () => { throw new Error("unavailable"); } },
    ];
    const result = await loadCompanyEvidence("msft", providers);
    expect(result.fundamentals?.revenueGrowthPct).toBe(22);
    expect(result.earnings).toHaveLength(1);
  });

  it("recomputes visible metrics and score from normalized fundamentals", () => {
    const baseline = companies[0]!;
    const enriched = applyEvidence(baseline, evidence);
    expect(enriched.fundamentals.find((metric) => metric.label === "Revenue growth")?.value).toBe("22.0%");
    expect(enriched.keyChange).toContain("beat estimates by 5.0%");
    expect(enriched.health).toBeGreaterThanOrEqual(baseline.health);
    expect(enriched.evidence?.fundamentals?.provenance.source).toBe("Test provider");
  });

  it("stores only material score, band, momentum, or fundamental changes", () => {
    const baseline = companies[0]!;
    expect(detectMaterialTransitions(baseline, { ...baseline, health: baseline.health + 1 }, "2026-07-31T20:00:00Z")).toEqual([]);
    const changed = { ...baseline, health: baseline.health - 5, healthLabel: "Healthy" as const, momentum: "Flat" as const, momentumDirection: "flat" as const };
    const transitions = detectMaterialTransitions(baseline, changed, "2026-07-31T20:00:00Z");
    expect(transitions.map((transition) => transition.transitionType)).toEqual(expect.arrayContaining(["health-label", "momentum"]));
  });
});

describe("Workers AI validation", () => {
  const fallback = { answer: "This is a deterministic evidence-based fallback answer.", highlights: [{ label: "Health", value: "92" }], followUps: ["What changed?"] };

  it("accepts schema-compliant answers and rejects trade instructions", () => {
    expect(validateAssistantAnswer({ answer: "The evidence supports a healthy profile without making a price prediction.", highlights: [{ label: "Health", value: "92/100" }], followUps: ["What changed?"] })?.mode).toBe("ai");
    expect(validateAssistantAnswer({ answer: "You should buy MSFT because the score is high.", highlights: [{ label: "Health", value: "92/100" }], followUps: ["What changed?"] })).toBeUndefined();
  });

  it("uses validated AI output and falls back when inference fails", async () => {
    const valid: WorkersAiClient = { run: async () => ({ response: JSON.stringify({ answer: "Microsoft has strong health, with baseline fundamentals and market evidence clearly timestamped.", highlights: [{ label: "Health", value: "92/100" }], followUps: ["What changed for MSFT?"] }) }) };
    const failed: WorkersAiClient = { run: async () => { throw new Error("offline"); } };
    expect((await answerWithWorkersAi(valid, "How is MSFT?", [companies[0]!], fallback)).mode).toBe("ai");
    expect((await answerWithWorkersAi(failed, "How is MSFT?", [companies[0]!], fallback)).mode).toBe("deterministic");
  });
});
