PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  shares REAL NOT NULL DEFAULT 0,
  average_cost REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(portfolio_id, symbol)
);

CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  symbol TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, symbol)
);

CREATE TABLE IF NOT EXISTS company_cache (
  symbol TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_prices (
  symbol TEXT NOT NULL,
  price_date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  volume INTEGER,
  source TEXT NOT NULL,
  PRIMARY KEY(symbol, price_date)
);

CREATE TABLE IF NOT EXISTS earnings (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  period_end TEXT NOT NULL,
  reported_at TEXT,
  payload TEXT NOT NULL,
  source TEXT NOT NULL,
  UNIQUE(symbol, period_end)
);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  source TEXT NOT NULL,
  published_at TEXT NOT NULL,
  impact TEXT,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  symbol TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  threshold REAL,
  enabled INTEGER NOT NULL DEFAULT 1,
  triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thesis (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  symbol TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, symbol)
);

CREATE TABLE IF NOT EXISTS ai_summaries (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  summary_type TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  evidence_as_of TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prices_symbol_date ON daily_prices(symbol, price_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_symbol_date ON news(symbol, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_owner ON alerts(owner_id, enabled);
