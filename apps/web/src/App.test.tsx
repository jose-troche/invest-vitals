import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dashboardData, findCompany } from "@invest-vitals/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";
import { WatchlistProvider } from "./hooks/use-watchlist";

describe("application shell", () => {
  function renderAt(path: string) {
    window.history.replaceState({}, "", path);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["dashboard"], dashboardData);
    const symbol = path.match(/\/company\/([^/?]+)/)?.[1];
    if (symbol) queryClient.setQueryData(["company", symbol], findCompany(symbol));
    return renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <WatchlistProvider>
          <App />
        </WatchlistProvider>
      </QueryClientProvider>,
    );
  }

  it("renders the primary investment workflows", () => {
    const markup = renderAt("/");
    expect(markup).toContain("Invest Vitals");
    expect(markup).toContain("Watchlist");
    expect(markup).toContain("Ask Vitals");
    expect(markup).toContain("Good morning");
  });

  it.each([
    ["/company/MSFT", "Microsoft"],
    ["/watchlist", "Companies on your radar"],
    ["/compare", "Compare the evidence"],
    ["/alerts", "Meaningful changes, filtered"],
    ["/assistant", "What would you like to understand?"],
  ])("renders %s", (path, copy) => {
    expect(renderAt(path)).toContain(copy);
  });
});
