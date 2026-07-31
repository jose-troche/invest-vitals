import { app } from "./index";
import { describe, expect, it } from "vitest";

describe("Invest Vitals API", () => {
  it("returns the dashboard contract", async () => {
    const response = await app.request("/api/dashboard");
    const body = await response.json() as { companies: unknown[]; dataMode: string };
    expect(response.status).toBe(200);
    expect(body.companies).toHaveLength(5);
    expect(body.dataMode).toBe("illustrative");
  });

  it("returns a company or a useful 404", async () => {
    expect((await app.request("/api/companies/MSFT")).status).toBe(200);
    expect((await app.request("/api/companies/NOPE")).status).toBe(404);
  });

  it("returns the local watchlist contract without a provider binding", async () => {
    const response = await app.request("/api/watchlist?symbols=MSFT,NOPE");
    const body = await response.json() as { quotes: Array<{ symbol: string }>; unavailable: string[] };
    expect(response.status).toBe(200);
    expect(body.quotes.map((quote) => quote.symbol)).toEqual(["MSFT"]);
    expect(body.unavailable).toEqual(["NOPE"]);
  });

  it("answers assistant questions deterministically", async () => {
    const response = await app.request("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Which holding worries you?" }),
    });
    const body = await response.json() as { answer: string };
    expect(response.status).toBe(200);
    expect(body.answer).toContain("Apple");
  });
});
