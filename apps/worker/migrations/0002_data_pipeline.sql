CREATE TABLE IF NOT EXISTS provider_evidence (
  symbol TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('fundamentals', 'earnings', 'sec', 'news')),
  evidence_key TEXT NOT NULL,
  as_of TEXT NOT NULL,
  payload TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY(symbol, evidence_type, evidence_key)
);

CREATE TABLE IF NOT EXISTS market_history (
  symbol TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  price REAL NOT NULL,
  previous_close REAL NOT NULL,
  day_change_pct REAL NOT NULL,
  momentum_score INTEGER NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(symbol, observed_at)
);

CREATE TABLE IF NOT EXISTS health_history (
  symbol TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  health_score INTEGER NOT NULL,
  health_label TEXT NOT NULL,
  momentum_score INTEGER NOT NULL,
  momentum_direction TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(symbol, observed_at)
);

CREATE TABLE IF NOT EXISTS alert_transitions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  transition_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  previous_value TEXT,
  current_value TEXT NOT NULL,
  evidence_as_of TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, transition_type, previous_value, current_value, evidence_as_of)
);

CREATE INDEX IF NOT EXISTS idx_provider_evidence_latest ON provider_evidence(symbol, evidence_type, as_of DESC);
CREATE INDEX IF NOT EXISTS idx_market_history_latest ON market_history(symbol, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_history_latest ON health_history(symbol, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_transitions_latest ON alert_transitions(created_at DESC);
