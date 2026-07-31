import { companies } from "@invest-vitals/domain";
import { describe, expect, it } from "vitest";
import { enrichCompany, normalizeChartResponse, normalizeSearchResponse } from "./market-provider";

describe("market provider normalization", () => {
  const timestamps = [2021, 2022, 2023, 2024, 2025, 2026].map((year) => Date.UTC(year, 0, 2) / 1000);
  const payload = {
    chart: {
      result: [{
        meta: {
          symbol: "TEST",
          longName: "Test Company",
          currency: "USD",
          fullExchangeName: "NasdaqGS",
          regularMarketPrice: 210,
          previousClose: 200,
          regularMarketTime: Date.UTC(2026, 6, 31, 20) / 1000,
        },
        timestamp: timestamps,
        indicators: { adjclose: [{ adjclose: [100, 90, 120, 150, 180, 200] }] },
      }],
      error: null,
    },
  };

  it("derives current quote, performance, and provenance", () => {
    const snapshot = normalizeChartResponse(payload, "2026-07-31T20:01:00.000Z", 200);
    expect(snapshot.symbol).toBe("TEST");
    expect(snapshot.price).toBe(210);
    expect(snapshot.dayChangePct).toBe(5);
    expect(snapshot.performance).toHaveLength(6);
    expect(snapshot.annualReturns.at(-1)?.year).toBe(2026);
    expect(snapshot.marketData.status).toBe("live");
    expect(snapshot.marketData.source).toContain("unofficial");
  });

  it("updates only market-derived company fields", () => {
    const baseline = companies[0]!;
    const enriched = enrichCompany(baseline, normalizeChartResponse(payload, undefined, 200));
    expect(enriched.price).toBe(210);
    expect(enriched.fundamentals).toEqual(baseline.fundamentals);
    expect(enriched.marketData?.status).toBe("live");
  });

  it("filters search results to supported unique market instruments", () => {
    expect(normalizeSearchResponse({ quotes: [
      { symbol: "NVDA", longname: "NVIDIA Corporation", quoteType: "EQUITY", exchDisp: "NASDAQ" },
      { symbol: "NVDA", longname: "Duplicate", quoteType: "EQUITY" },
      { symbol: "NVDA240", shortname: "Option", quoteType: "OPTION" },
    ] })).toEqual([{ symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "EQUITY" }]);
  });
});
