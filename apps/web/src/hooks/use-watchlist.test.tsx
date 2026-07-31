import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useWatchlist, WatchlistProvider } from "./use-watchlist";

function Harness() {
  const { symbols, addSymbol, removeSymbol } = useWatchlist();
  return <div><output>{symbols.join(",")}</output><button onClick={() => addSymbol("MSFT")}>add</button><button onClick={() => removeSymbol("GOOGL")}>remove</button></div>;
}

describe("local watchlist", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    container?.remove();
  });

  it("adds, removes, and persists symbols without authentication", async () => {
    const root = createRoot(container);
    await act(async () => root.render(<WatchlistProvider><Harness /></WatchlistProvider>));
    expect(container.querySelector("output")?.textContent).toBe("GOOGL,AMZN");

    await act(async () => (container.querySelectorAll("button")[0] as HTMLButtonElement).click());
    await act(async () => (container.querySelectorAll("button")[1] as HTMLButtonElement).click());

    expect(container.querySelector("output")?.textContent).toBe("AMZN,MSFT");
    expect(JSON.parse(window.localStorage.getItem("invest-vitals:watchlist:v1") ?? "[]")).toEqual(["AMZN", "MSFT"]);
    await act(async () => root.unmount());
  });
});
