import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "invest-vitals:watchlist:v1";
const DEFAULT_SYMBOLS = ["GOOGL", "AMZN"];

interface WatchlistContextValue {
  symbols: string[];
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  hasSymbol: (symbol: string) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | undefined>(undefined);

function readWatchlist(): string[] {
  if (typeof window === "undefined") return DEFAULT_SYMBOLS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : DEFAULT_SYMBOLS;
  } catch {
    return DEFAULT_SYMBOLS;
  }
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [symbols, setSymbols] = useState<string[]>(readWatchlist);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  const value = useMemo<WatchlistContextValue>(() => ({
    symbols,
    addSymbol: (symbol) => setSymbols((current) => {
      const normalized = symbol.toUpperCase();
      return current.includes(normalized) ? current : [...current, normalized];
    }),
    removeSymbol: (symbol) => setSymbols((current) => current.filter((item) => item !== symbol.toUpperCase())),
    hasSymbol: (symbol) => symbols.includes(symbol.toUpperCase()),
  }), [symbols]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error("useWatchlist must be used within WatchlistProvider");
  return context;
}
