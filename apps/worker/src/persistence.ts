import type {
  AlertTransition,
  Company,
  CompanyEvidence,
  CompanyHistoryPoint,
  MarketSnapshot,
  NormalizedEarnings,
  NormalizedFundamentals,
  NormalizedNewsItem,
  NormalizedSecFiling,
} from "@invest-vitals/domain";

interface EvidenceRow { evidence_type: string; payload: string }
interface CompanyPayloadRow { payload: string }
interface AlertRow {
  id: string;
  symbol: string;
  transition_type: AlertTransition["transitionType"];
  severity: AlertTransition["severity"];
  title: string;
  reason: string;
  previous_value: string | null;
  current_value: string;
  evidence_as_of: string;
  created_at: string;
}
interface HistoryRow {
  observed_at: string;
  price: number;
  day_change_pct: number;
  health_score: number;
  health_label: CompanyHistoryPoint["healthLabel"];
  momentum_score: number;
  source: string;
}

function parseJson<T>(value: string): T | undefined {
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function evidenceStatement(db: D1Database, symbol: string, type: string, key: string, asOf: string, source: string, fetchedAt: string, payload: unknown): D1PreparedStatement {
  return db.prepare(`INSERT OR REPLACE INTO provider_evidence
    (symbol, evidence_type, evidence_key, as_of, payload, source, fetched_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(symbol, type, key, asOf, JSON.stringify(payload), source, fetchedAt);
}

function evidenceStatements(db: D1Database, evidence: CompanyEvidence): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  if (evidence.fundamentals) {
    const item = evidence.fundamentals;
    statements.push(evidenceStatement(db, evidence.symbol, "fundamentals", item.fiscalPeriod, item.provenance.asOf, item.provenance.source, item.provenance.fetchedAt, item));
  }
  for (const item of evidence.earnings) statements.push(evidenceStatement(db, evidence.symbol, "earnings", item.fiscalDateEnding, item.provenance.asOf, item.provenance.source, item.provenance.fetchedAt, item));
  for (const item of evidence.filings) statements.push(evidenceStatement(db, evidence.symbol, "sec", item.accessionNumber, item.provenance.asOf, item.provenance.source, item.provenance.fetchedAt, item));
  for (const item of evidence.news) statements.push(evidenceStatement(db, evidence.symbol, "news", item.id, item.provenance.asOf, item.provenance.source, item.provenance.fetchedAt, item));
  return statements;
}

export async function loadLatestEvidence(db: D1Database, symbol: string): Promise<CompanyEvidence> {
  const normalized = symbol.toUpperCase();
  const result = await db.prepare(`SELECT evidence_type, payload FROM provider_evidence
    WHERE symbol = ?1 ORDER BY as_of DESC LIMIT 80`).bind(normalized).all<EvidenceRow>();
  const evidence: CompanyEvidence = { symbol: normalized, earnings: [], filings: [], news: [] };
  for (const row of result.results) {
    if (row.evidence_type === "fundamentals" && !evidence.fundamentals) evidence.fundamentals = parseJson<NormalizedFundamentals>(row.payload);
    if (row.evidence_type === "earnings" && evidence.earnings.length < 8) {
      const item = parseJson<NormalizedEarnings>(row.payload);
      if (item) evidence.earnings.push(item);
    }
    if (row.evidence_type === "sec" && evidence.filings.length < 12) {
      const item = parseJson<NormalizedSecFiling>(row.payload);
      if (item) evidence.filings.push(item);
    }
    if (row.evidence_type === "news" && evidence.news.length < 10) {
      const item = parseJson<NormalizedNewsItem>(row.payload);
      if (item) evidence.news.push(item);
    }
  }
  return evidence;
}

export function detectMaterialTransitions(previous: Company | undefined, current: Company, evidenceAsOf: string): AlertTransition[] {
  if (!previous) return [];
  const transitions: AlertTransition[] = [];
  const create = (transition: Omit<AlertTransition, "id" | "symbol" | "evidenceAsOf" | "createdAt">): AlertTransition => ({
    ...transition,
    id: crypto.randomUUID(),
    symbol: current.symbol,
    evidenceAsOf,
    createdAt: new Date().toISOString(),
  });

  if (previous.healthLabel !== current.healthLabel) {
    transitions.push(create({
      transitionType: "health-label",
      severity: current.health > previous.health ? "positive" : "attention",
      title: `Health changed to ${current.healthLabel}`,
      reason: `The transparent weighted score moved from ${previous.health}/100 to ${current.health}/100.`,
      previousValue: previous.healthLabel,
      currentValue: current.healthLabel,
    }));
  } else if (Math.abs(current.health - previous.health) >= 3) {
    transitions.push(create({
      transitionType: "health-score",
      severity: current.health > previous.health ? "positive" : "watch",
      title: `Health moved ${current.health > previous.health ? "higher" : "lower"}`,
      reason: `The transparent weighted score changed by ${Math.abs(current.health - previous.health)} points.`,
      previousValue: String(previous.health),
      currentValue: String(current.health),
    }));
  }

  if (previous.momentumDirection !== current.momentumDirection) {
    transitions.push(create({
      transitionType: "momentum",
      severity: current.momentumDirection === "up" ? "positive" : current.momentumDirection === "down" ? "attention" : "watch",
      title: `Momentum turned ${current.momentumDirection}`,
      reason: `Multi-period momentum changed from ${previous.momentum.toLowerCase()} to ${current.momentum.toLowerCase()}.`,
      previousValue: previous.momentum,
      currentValue: current.momentum,
    }));
  }

  const previousMetrics = new Map(previous.fundamentals.map((metric) => [metric.label, metric]));
  for (const metric of current.fundamentals) {
    const prior = previousMetrics.get(metric.label);
    if (!prior || prior.status === metric.status || prior.value === metric.value) continue;
    transitions.push(create({
      transitionType: "fundamental",
      severity: metric.status === "positive" ? "positive" : metric.status === "negative" ? "attention" : "watch",
      title: `${metric.label} signal changed`,
      reason: `${metric.label} moved from ${prior.value} (${prior.status}) to ${metric.value} (${metric.status}).`,
      previousValue: `${prior.value}:${prior.status}`,
      currentValue: `${metric.value}:${metric.status}`,
    }));
  }
  return transitions;
}

export async function persistRefresh(db: D1Database, company: Company, market: MarketSnapshot, evidence: CompanyEvidence): Promise<AlertTransition[]> {
  const priorRow = await db.prepare(`SELECT payload FROM health_history WHERE symbol = ?1 ORDER BY observed_at DESC LIMIT 1`)
    .bind(company.symbol).first<CompanyPayloadRow>();
  const previous = priorRow ? parseJson<Company>(priorRow.payload) : undefined;
  const transitions = detectMaterialTransitions(previous, company, market.marketTime);
  const statements = [
    ...evidenceStatements(db, evidence),
    db.prepare(`INSERT OR REPLACE INTO market_history
      (symbol, observed_at, price, previous_close, day_change_pct, momentum_score, source, fetched_at, payload)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(market.symbol, market.marketTime, market.price, market.previousClose, market.dayChangePct, market.momentumScore, market.marketData.source, market.marketData.fetchedAt, JSON.stringify(market)),
    db.prepare(`INSERT OR REPLACE INTO health_history
      (symbol, observed_at, health_score, health_label, momentum_score, momentum_direction, payload)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(company.symbol, market.marketTime, company.health, company.healthLabel, company.momentumScore, company.momentumDirection, JSON.stringify(company)),
    ...transitions.map((transition) => db.prepare(`INSERT OR IGNORE INTO alert_transitions
      (id, symbol, transition_type, severity, title, reason, previous_value, current_value, evidence_as_of, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
      .bind(transition.id, transition.symbol, transition.transitionType, transition.severity, transition.title, transition.reason, transition.previousValue ?? null, transition.currentValue, transition.evidenceAsOf, transition.createdAt)),
  ];
  await db.batch(statements);
  return transitions;
}

export async function loadRecentTransitions(db: D1Database, limit = 20): Promise<AlertTransition[]> {
  const result = await db.prepare(`SELECT id, symbol, transition_type, severity, title, reason,
    previous_value, current_value, evidence_as_of, created_at
    FROM alert_transitions ORDER BY created_at DESC LIMIT ?1`).bind(Math.max(1, Math.min(100, limit))).all<AlertRow>();
  return result.results.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    transitionType: row.transition_type,
    severity: row.severity,
    title: row.title,
    reason: row.reason,
    previousValue: row.previous_value ?? undefined,
    currentValue: row.current_value,
    evidenceAsOf: row.evidence_as_of,
    createdAt: row.created_at,
  }));
}

export async function loadCompanyHistory(db: D1Database, symbol: string, limit = 90): Promise<CompanyHistoryPoint[]> {
  const result = await db.prepare(`SELECT m.observed_at, m.price, m.day_change_pct, h.health_score,
    h.health_label, h.momentum_score, m.source
    FROM market_history m JOIN health_history h ON h.symbol = m.symbol AND h.observed_at = m.observed_at
    WHERE m.symbol = ?1 ORDER BY m.observed_at DESC LIMIT ?2`)
    .bind(symbol.toUpperCase(), Math.max(1, Math.min(365, limit))).all<HistoryRow>();
  return result.results.map((row) => ({
    observedAt: row.observed_at,
    price: row.price,
    dayChangePct: row.day_change_pct,
    health: row.health_score,
    healthLabel: row.health_label,
    momentumScore: row.momentum_score,
    source: row.source,
  }));
}
