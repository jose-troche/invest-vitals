import { useMutation, useQuery } from "@tanstack/react-query";
import type { AlertItem, Company, Signal } from "@invest-vitals/domain";
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, Bot, BriefcaseBusiness,
  Check, ChevronDown, CircleAlert, CircleCheck, Clock3, GitCompareArrows, HeartPulse,
  Info, LayoutDashboard, Menu, MessageCircleMore, Minus, Plus, Search, ShieldCheck,
  Sparkles, Star, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { useEffect, useId, useMemo, useState, type AnchorHTMLAttributes, type MouseEventHandler, type ReactNode } from "react";
import { Link as WouterLink, Redirect, Route, Switch, useLocation, useRoute } from "wouter";
import { askAssistant, compareCompanies, getCompany, getDashboard, getWatchlistQuotes, searchSymbols } from "./lib/api";
import { useWatchlist } from "./hooks/use-watchlist";
import { AnnualReturns, HealthRing, Sparkline } from "./components/charts";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { cn } from "./lib/cn";
import { formatMarketTime, formatToday, getGreeting } from "./lib/greeting";

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/assistant", label: "Ask Vitals", icon: MessageCircleMore },
];

function Modal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <div className="modal-heading">
          <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={`Close ${title}`}><X size={19} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Link({ to, children, ...props }: { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return <WouterLink href={to} {...props}>{children}</WouterLink>;
}

function NavLink({ to, end = false, children, className, onClick }: { to: string; end?: boolean; children: ReactNode; className: (args: { isActive: boolean }) => string; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  const [location] = useLocation();
  const isActive = end ? location === to : location.startsWith(to);
  return <WouterLink href={to} className={className({ isActive })} onClick={onClick}>{children}</WouterLink>;
}

function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: compact ? 0 : 2, notation: compact ? "compact" : "standard" }).format(value);
}

function DirectionIcon({ direction, size = 15 }: { direction: "up" | "flat" | "down"; size?: number }) {
  if (direction === "up") return <ArrowUp size={size} />;
  if (direction === "down") return <ArrowDown size={size} />;
  return <Minus size={size} />;
}

function StatusDot({ status }: { status: Signal }) {
  return <span className={cn("status-dot", `status-${status}`)} aria-label={status} />;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileOpen && "sidebar-open")}>
        <div className="brand-row">
          <Link to="/" className="brand" onClick={() => setMobileOpen(false)}>
            <span className="brand-mark"><HeartPulse size={20} strokeWidth={2.4} /></span>
            <span>Invest Vitals</span>
          </Link>
          <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setMobileOpen(false)} className={({ isActive }) => cn("nav-item", isActive && "nav-item-active")}>
              <Icon size={18} /><span>{label}</span>{label === "Alerts" && <i className="nav-count">2</i>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-insight">
          <span className="eyebrow"><Sparkles size={13} /> Daily pulse</span>
          <strong>2 holdings need attention</strong>
          <p>Apple's health fell below 70. Amazon's momentum turned flat.</p>
          <Link to="/alerts">Review changes <ArrowRight size={14} /></Link>
        </div>
        <div className="sidebar-profile">
          <span className="avatar">JT</span>
          <div><strong>My portfolio</strong><small>Local workspace</small></div>
          <ChevronDown size={16} />
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <div className="main-column">
        <header className="mobile-header">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <Link to="/" className="brand"><span className="brand-mark"><HeartPulse size={18} /></span><span>Invest Vitals</span></Link>
          <Link to="/alerts" className="mobile-alert"><Bell size={20} /><i /></Link>
        </header>
        <main className="main-content">{children}</main>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => cn(isActive && "bottom-nav-active")}>
              <Icon size={19} /><span>{label === "Ask Vitals" ? "Ask" : label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

function SummaryCard({ label, value, detail, tone = "neutral", icon }: { label: string; value: string; detail: string; tone?: "positive" | "negative" | "neutral"; icon?: React.ReactNode }) {
  return (
    <Card className="summary-card">
      <div className="summary-label"><span>{label}</span>{icon}</div>
      <strong>{value}</strong>
      <small className={tone === "neutral" ? "" : `text-${tone}`}>{detail}</small>
    </Card>
  );
}

type SortKey = "symbol" | "health" | "momentumScore" | "valuationLabel" | "dayChangePct";

function HoldingsTable({ companies }: { companies: Company[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("health");
  const [ascending, setAscending] = useState(false);
  const [, navigate] = useLocation();
  const sorted = useMemo(() => [...companies].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
    return ascending ? result : -result;
  }), [companies, sortKey, ascending]);

  const sort = (key: SortKey) => {
    if (sortKey === key) setAscending((value) => !value);
    else { setSortKey(key); setAscending(false); }
  };

  const SortLabel = ({ column, children }: { column: SortKey; children: React.ReactNode }) => (
    <button onClick={() => sort(column)}>{children}{sortKey === column && (ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button>
  );

  return (
    <>
      <div className="holdings-table-wrap">
        <table className="holdings-table">
          <thead><tr><th><SortLabel column="symbol">Holding</SortLabel></th><th>Value</th><th><SortLabel column="health">Health</SortLabel></th><th><SortLabel column="momentumScore">Momentum</SortLabel></th><th><SortLabel column="valuationLabel">Valuation</SortLabel></th><th><SortLabel column="dayChangePct">Today</SortLabel></th><th>What changed</th><th><span className="sr-only">Open</span></th></tr></thead>
          <tbody>{sorted.map((company) => (
            <tr key={company.symbol} onClick={() => navigate(`/company/${company.symbol}`)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && navigate(`/company/${company.symbol}`)}>
              <td><div className="company-cell"><span className="company-logo" style={{ background: company.accent }}>{company.symbol.slice(0, 1)}</span><div><strong>{company.symbol}</strong><small>{company.name}</small></div></div></td>
              <td><strong>{formatCurrency(company.price * company.shares, true)}</strong><small>{company.allocationPct}% allocation</small></td>
              <td><div className="health-cell"><HealthRing score={company.health} size={46} /><div><strong>{company.healthLabel}</strong><small className={company.healthDelta >= 0 ? "text-positive" : "text-negative"}>{company.healthDelta >= 0 ? "+" : ""}{company.healthDelta} pts</small></div></div></td>
              <td><span className={cn("momentum-label", `momentum-${company.momentumDirection}`)}><DirectionIcon direction={company.momentumDirection} />{company.momentum}</span></td>
              <td><Badge className={cn(company.valuationLabel === "Expensive" && "badge-negative", company.valuationLabel === "Attractive" && "badge-positive")}>{company.valuationLabel}</Badge></td>
              <td><span className={company.dayChangePct >= 0 ? "text-positive" : "text-negative"}>{company.dayChangePct >= 0 ? "+" : ""}{company.dayChangePct}%</span></td>
              <td className="change-cell">{company.keyChange}</td>
              <td><ArrowRight size={16} className="row-arrow" /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="holding-cards">{sorted.map((company) => (
        <Link to={`/company/${company.symbol}`} className="holding-card" key={company.symbol}>
          <div className="holding-card-head"><div className="company-cell"><span className="company-logo" style={{ background: company.accent }}>{company.symbol[0]}</span><div><strong>{company.symbol}</strong><small>{company.name}</small></div></div><HealthRing score={company.health} size={52} /></div>
          <p>{company.keyChange}</p>
          <div className="holding-card-foot"><span className={cn("momentum-label", `momentum-${company.momentumDirection}`)}><DirectionIcon direction={company.momentumDirection} />{company.momentum}</span><span className={company.dayChangePct >= 0 ? "text-positive" : "text-negative"}>{company.dayChangePct >= 0 ? "+" : ""}{company.dayChangePct}% today</span></div>
        </Link>
      ))}</div>
    </>
  );
}

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  if (isLoading || !data) return <PageSkeleton />;
  const { portfolio, companies, alerts } = data;
  const configuredName = import.meta.env.VITE_USER_NAME?.trim();
  const marketLabel = data.dataMode === "illustrative" ? "Illustrative fallback" : data.marketData.status === "fallback" ? "Partial market data" : data.marketData.status === "cached" ? "Cached market data" : "Fresh market data";
  return (
    <div className="page dashboard-page">
      <PageHeading eyebrow={formatToday()} title={getGreeting(new Date(), configuredName)} description="Track market movement alongside your baseline fundamentals and investment thesis." actions={<><Badge className="data-badge" title={data.marketData.note}><Info size={13} /> {marketLabel}</Badge><Button asChild><Link to="/assistant"><Sparkles size={16} /> Ask Vitals</Link></Button></>} />
      <section className="portfolio-hero">
        <div className="portfolio-total"><span>Portfolio value</span><strong>{formatCurrency(portfolio.totalValue)}</strong><p className="text-positive"><TrendingUp size={16} /> {formatCurrency(portfolio.dayChangeValue)} ({portfolio.dayChangePct}%) today</p></div>
        <div className="portfolio-periods">{Object.entries(portfolio.periodReturns).map(([period, value]) => <div key={period}><span>{period}</span><strong className={value >= 0 ? "text-positive" : "text-negative"}>{value >= 0 ? "+" : ""}{value}%</strong></div>)}</div>
        <div className="hero-health"><HealthRing score={portfolio.averageHealth} size={98} /><div><span>Portfolio health</span><strong>Healthy</strong><small>+1 point this week</small></div></div>
      </section>
      <section className="summary-grid">
        <SummaryCard label="Avg. momentum" value={`${portfolio.averageMomentum}/100`} detail="Positive across 3 holdings" tone="positive" icon={<Activity size={17} />} />
        <SummaryCard label="Portfolio risk" value={portfolio.risk} detail="Concentration is the main risk" icon={<ShieldCheck size={17} />} />
        <SummaryCard label="Diversification" value={`${portfolio.diversification}/100`} detail="Technology exposure is elevated" icon={<BriefcaseBusiness size={17} />} />
        <SummaryCard label="Range this month" value={`${portfolio.largestWinner.split(" ")[0]} → ${portfolio.largestLoser.split(" ")[0]}`} detail={`${portfolio.largestWinner} best · ${portfolio.largestLoser} worst`} icon={<TrendingUp size={17} />} />
      </section>
      <section className="attention-card">
        <div className="attention-icon"><CircleAlert size={21} /></div>
        <div><span className="eyebrow">What changed</span><h2>Two signals moved against your thesis</h2><p><strong>Apple</strong> fell below 70 as growth weakened. <strong>Amazon</strong> lost momentum after softer cloud growth.</p></div>
        <Button asChild variant="secondary"><Link to="/alerts">Review changes <ArrowRight size={15} /></Link></Button>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Your holdings</p><h2>Portfolio health</h2></div><div className="section-note"><Clock3 size={14} /> Market as of {formatMarketTime(data.marketData.asOf)}</div></div>
        <HoldingsTable companies={companies} />
      </section>
      <section className="lower-grid">
        <Card className="signal-card"><div className="section-heading compact"><div><p className="eyebrow">Signal map</p><h2>Health vs. momentum</h2></div></div><div className="signal-map"><div className="signal-quadrant-label q1">Strong & strengthening</div><div className="signal-quadrant-label q2">Healthy, slowing</div><div className="signal-quadrant-label q3">Weak & weakening</div>{companies.map((company) => <Link to={`/company/${company.symbol}`} key={company.symbol} className="signal-point" style={{ left: `${Math.max(8, Math.min(88, company.momentumScore))}%`, bottom: `${Math.max(10, Math.min(88, company.health - 10))}%`, background: company.accent }} title={`${company.symbol}: ${company.health} health, ${company.momentumScore} momentum`}>{company.symbol}</Link>)}</div><div className="axis-label axis-x">Momentum →</div><div className="axis-label axis-y">Health →</div></Card>
        <Card className="recent-alerts"><div className="section-heading compact"><div><p className="eyebrow">Recent signals</p><h2>Alerts</h2></div><Link to="/alerts">View all</Link></div>{alerts.slice(0, 3).map((alert) => <AlertRow key={alert.id} alert={alert} compact />)}</Card>
      </section>
      <Disclaimer />
    </div>
  );
}

const THESIS_STORAGE_KEY = "invest-vitals:theses:v1";

function readThesisOverrides(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(THESIS_STORAGE_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((item) => typeof item === "string")));
  } catch {
    return {};
  }
}

function ThesisEditor({ company, thesis, open, onClose, onSave, onRestore }: { company: Company; thesis: string[]; open: boolean; onClose: () => void; onSave: (items: string[]) => void; onRestore: () => void }) {
  const [draft, setDraft] = useState(thesis);

  useEffect(() => {
    if (open) setDraft(thesis);
  }, [open, thesis]);

  const cleaned = draft.map((item) => item.trim()).filter(Boolean);
  return (
    <Modal open={open} onClose={onClose} title={`Edit ${company.symbol} thesis`} description="Keep the reasons you own this company current. Changes stay in this browser.">
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave(cleaned); }}>
        <div className="thesis-editor-list">
          {draft.map((item, index) => (
            <div className="thesis-editor-row" key={index}>
              <label htmlFor={`thesis-${company.symbol}-${index}`}>Thesis point {index + 1}</label>
              <div><textarea id={`thesis-${company.symbol}-${index}`} value={item} onChange={(event) => setDraft((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /><button type="button" onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove thesis point ${index + 1}`}><X size={16} /></button></div>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((current) => [...current, ""])}><Plus size={15} /> Add thesis point</Button>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={() => { onRestore(); onClose(); }}>Restore default</Button>
          <div><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={cleaned.length === 0}>Save thesis</Button></div>
        </div>
      </form>
    </Modal>
  );
}

function CompanyPage() {
  const [, params] = useRoute<{ symbol: string }>("/company/:symbol");
  const symbol = params?.symbol ?? "";
  const { data: company, isLoading } = useQuery({ queryKey: ["company", symbol], queryFn: () => getCompany(symbol) });
  const watchlist = useWatchlist();
  const [thesisOverrides, setThesisOverrides] = useState<Record<string, string[]>>(readThesisOverrides);
  const [thesisOpen, setThesisOpen] = useState(false);
  useEffect(() => {
    window.localStorage.setItem(THESIS_STORAGE_KEY, JSON.stringify(thesisOverrides));
  }, [thesisOverrides]);
  if (isLoading) return <PageSkeleton />;
  if (!company) return <Redirect to="/" replace />;
  const thesis = thesisOverrides[company.symbol] ?? company.thesis;
  return (
    <div className="page company-page">
      <Link to="/" className="back-link"><ArrowLeft size={15} /> Back to portfolio</Link>
      <header className="company-hero">
        <div className="company-title"><span className="company-logo company-logo-large" style={{ background: company.accent }}>{company.symbol[0]}</span><div><div className="company-symbol-line"><h1>{company.name}</h1><Badge>{company.symbol}</Badge></div><p>{company.sector} · {formatCurrency(company.price)} <span className={company.dayChangePct >= 0 ? "text-positive" : "text-negative"}>{company.dayChangePct >= 0 ? "+" : ""}{company.dayChangePct}% today</span></p></div></div>
        <div className="company-actions"><Button variant="secondary" onClick={() => watchlist.hasSymbol(company.symbol) ? watchlist.removeSymbol(company.symbol) : watchlist.addSymbol(company.symbol)}>{watchlist.hasSymbol(company.symbol) ? <Check size={16} /> : <Plus size={16} />}{watchlist.hasSymbol(company.symbol) ? "Watching" : "Add to watchlist"}</Button><Button asChild><Link to={`/assistant?q=What changed for ${company.symbol}?`}><Sparkles size={16} /> Ask about {company.symbol}</Link></Button></div>
      </header>
      <section className="company-status-grid">
        <Card className="company-health-card"><HealthRing score={company.health} size={128} /><div><span>Health score</span><h2>{company.healthLabel}</h2><p className={company.healthDelta >= 0 ? "text-positive" : "text-negative"}>{company.healthDelta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{company.healthDelta >= 0 ? "+" : ""}{company.healthDelta} points since earnings</p></div></Card>
        <Card className="key-change-card"><span className="eyebrow">What changed</span><h2>{company.keyChange}</h2><p>Updated {company.updatedAt} · Evidence from fundamentals, price trend, and recent company updates.</p></Card>
        <Card className="thesis-mini"><span className="eyebrow">Thesis check</span><div className={cn("thesis-state", company.status === "Needs review" && "thesis-state-warn")}><CircleCheck size={19} /><strong>{company.thesisStatus}</strong></div><Link to="#thesis">Review thesis <ArrowRight size={14} /></Link></Card>
      </section>
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Performance</p><h2>Returns at a glance</h2></div><span className="section-note">No price prediction · {company.marketData ? `${company.marketData.status} market history` : "illustrative fallback"}</span></div><div className="performance-grid">{company.performance.map((period) => <Card className="performance-card" key={period.shortLabel}><span>{period.label}</span><strong className={period.returnPct >= 0 ? "text-positive" : "text-negative"}>{period.returnPct > 0 ? "+" : ""}{period.returnPct}%</strong><Sparkline values={period.sparkline} positive={period.returnPct >= 0} width={132} /></Card>)}</div></section>
      <section className="detail-two-column">
        <Card className="momentum-card"><div className="section-heading compact"><div><p className="eyebrow">Momentum</p><h2>{company.momentum}</h2></div><span className={cn("momentum-score", `momentum-${company.momentumDirection}`)}><DirectionIcon direction={company.momentumDirection} />{company.momentumScore}/100</span></div><p>{company.momentumExplanation}</p><div className="momentum-periods">{company.performance.slice(0, 4).map((period) => <div key={period.shortLabel}><span>{period.shortLabel}</span><i className={period.returnPct >= 0 ? "positive-bar" : "negative-bar"} style={{ width: `${Math.max(12, Math.min(100, Math.abs(period.returnPct) * 4))}%` }} /><strong className={period.returnPct >= 0 ? "text-positive" : "text-negative"}>{period.returnPct > 0 ? "+" : ""}{period.returnPct}%</strong></div>)}</div></Card>
        <Card className="annual-card"><div className="section-heading compact"><div><p className="eyebrow">Annual returns</p><h2>Calendar years</h2></div></div><AnnualReturns returns={company.annualReturns} /></Card>
      </section>
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Health score</p><h2>Every point, explained</h2></div><Badge className="data-badge"><Info size={13} /> Weighted, not a black box</Badge></div><Card className="components-card">{company.healthComponents.map((component) => <div className="component-row" key={component.label}><div><strong>{component.label}</strong><small>{component.weight}% weight</small></div><div className="component-track"><i style={{ width: `${component.score}%` }} className={component.score >= 80 ? "positive-bar" : component.score >= 60 ? "neutral-bar" : "negative-bar"} /></div><strong>{component.score}</strong><span className={cn(`component-${component.trend}`)}><DirectionIcon direction={component.trend} /></span></div>)}</Card></section>
      <section className="detail-two-column wide-left">
        <Card className="metrics-card"><div className="section-heading compact"><div><p className="eyebrow">Fundamentals</p><h2>Business vitals</h2></div></div><div className="metric-grid">{company.fundamentals.map((item) => <div className="metric-item" key={item.label}><div><StatusDot status={item.status} /><span>{item.label}</span></div><strong>{item.value}</strong><small>{item.context}</small></div>)}</div></Card>
        <Card className="valuation-card"><div className="section-heading compact"><div><p className="eyebrow">Valuation</p><h2>{company.valuationLabel}</h2></div></div>{company.valuation.map((item) => <div className="valuation-row" key={item.label}><div><StatusDot status={item.status} /><span>{item.label}</span></div><strong>{item.value}</strong><small>History {item.history}</small><small>Sector {item.sector}</small></div>)}</Card>
      </section>
      <section className="ai-summary-section"><div className="ai-summary-heading"><span className="ai-orb"><Sparkles size={20} /></span><div><p className="eyebrow">Vitals brief</p><h2>What matters after the latest update</h2></div><Badge>Deterministic summary</Badge></div><div className="ai-summary-grid"><div className="summary-narrative">{company.aiSummary.map((sentence) => <p key={sentence}>{sentence}</p>)}</div><div className="pros-risks"><div><h3><CircleCheck size={17} /> Positives</h3>{company.positives.map((item) => <p key={item}>{item}</p>)}</div><div><h3><CircleAlert size={17} /> Risks</h3>{company.risks.map((item) => <p key={item}>{item}</p>)}</div></div></div></section>
      <section className="section-block" id="thesis"><div className="section-heading"><div><p className="eyebrow">Investment thesis</p><h2>Why you own {company.symbol}</h2></div><Button variant="secondary" onClick={() => setThesisOpen(true)}>Edit thesis</Button></div><Card className="thesis-card"><div className="thesis-list">{thesis.map((item, index) => <div key={`${index}-${item}`}><span>{index + 1}</span><p>{item}</p><CircleCheck size={18} /></div>)}</div><div className="thesis-verdict"><span>Current verdict</span><strong>{company.thesisStatus}</strong><p>Compared with the latest earnings, fundamentals, and material news.</p></div></Card></section>
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Recent news</p><h2>Signal, not noise</h2></div></div><div className="news-list">{company.news.map((item) => <Card className="news-item" key={item.id}><Badge className={`impact-${item.impact}`}>{item.impact}</Badge><div><h3>{item.title}</h3><p>{item.summary}</p><small>{item.source} · {item.age}</small></div><ArrowRight size={17} /></Card>)}</div></section>
      <Disclaimer />
      <ThesisEditor company={company} thesis={thesis} open={thesisOpen} onClose={() => setThesisOpen(false)} onSave={(items) => { setThesisOverrides((current) => ({ ...current, [company.symbol]: items })); setThesisOpen(false); }} onRestore={() => setThesisOverrides((current) => { const next = { ...current }; delete next[company.symbol]; return next; })} />
    </div>
  );
}

function WatchlistPage() {
  const { symbols, addSymbol, removeSymbol } = useWatchlist();
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const { data: watchlist, isLoading: watchlistLoading } = useQuery({
    queryKey: ["watchlist-quotes", symbols.join(",")],
    queryFn: () => getWatchlistQuotes(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: search, isFetching: searchLoading } = useQuery({
    queryKey: ["symbol-search", searchQuery],
    queryFn: () => searchSymbols(searchQuery),
    enabled: searchQuery.length > 0,
    staleTime: 30 * 60 * 1000,
  });
  const matches = (search?.results ?? []).filter((result) => !symbols.includes(result.symbol));
  const watched = watchlist?.quotes ?? [];
  return (
    <div className="page watchlist-page">
      <PageHeading eyebrow="Local watchlist" title="Companies on your radar" description="Search any supported ticker, then select it to add. Symbols stay in this browser; quotes refresh from the market-data provider." actions={<Badge className="data-badge"><ShieldCheck size={13} /> Stored locally</Badge>} />
      <Card className="watchlist-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a ticker or company (for example, NVDA)" aria-label="Search companies" />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={17} /></button>}{query && <div className="search-results">{searchLoading ? <p>Searching market symbols…</p> : matches.length > 0 ? matches.map((result) => <button key={result.symbol} onClick={() => { addSymbol(result.symbol); setQuery(""); }}><span className="company-logo">{result.symbol[0]}</span><span><strong>{result.symbol}</strong><small>{result.name} · {result.exchange}</small></span><Plus size={17} /></button>) : <p>No supported ticker matches “{query}”.</p>}</div>}</Card>
      {watchlistLoading ? <PageSkeleton compact /> : watched.length === 0 ? <Card className="empty-state"><span><Star size={28} /></span><h2>Your watchlist is empty</h2><p>Type a ticker or company above, then choose a search result to add it.</p></Card> : <div className="watchlist-grid">{watched.map((quote) => { const score = quote.health ?? quote.momentumScore; return <Card className="watch-card" key={quote.symbol}><div className="watch-card-head"><div className="company-cell"><span className="company-logo" style={{ background: quote.accent }}>{quote.symbol[0]}</span><div><strong>{quote.symbol}</strong><small>{quote.name}</small></div></div><button onClick={() => removeSymbol(quote.symbol)} aria-label={`Remove ${quote.symbol} from watchlist`}><X size={17} /></button></div><div className="watch-price"><strong>{formatCurrency(quote.price)}</strong><span className={quote.dayChangePct >= 0 ? "text-positive" : "text-negative"}>{quote.dayChangePct >= 0 ? "+" : ""}{quote.dayChangePct}% today</span></div><div className="watch-health"><HealthRing score={score} size={86} /><div><span>{quote.health !== undefined ? "Health" : "Market trend"}</span><strong>{quote.healthLabel ?? quote.momentum}</strong>{quote.healthDelta !== undefined ? <small className={quote.healthDelta >= 0 ? "text-positive" : "text-negative"}>{quote.healthDelta >= 0 ? "+" : ""}{quote.healthDelta} points</small> : <small>{score}/100 momentum</small>}</div></div><p className="watch-change"><span>Latest context</span>{quote.keyChange}</p><small className="watch-asof">As of {formatMarketTime(quote.marketData.asOf)} · {quote.marketData.status}</small><div className="watch-card-foot"><span className={cn("momentum-label", `momentum-${quote.momentumDirection}`)}><DirectionIcon direction={quote.momentumDirection} />{quote.momentum}</span>{quote.hasCompanyDetails ? <Button asChild variant="ghost" size="sm"><Link to={`/company/${quote.symbol}`}>Open <ArrowRight size={14} /></Link></Button> : <Badge>Market data only</Badge>}</div></Card>; })}</div>}
      {watchlist?.unavailable.length ? <p className="watchlist-warning">Quotes temporarily unavailable for: {watchlist.unavailable.join(", ")}.</p> : null}
      <Disclaimer />
    </div>
  );
}

function ComparePage() {
  const { data: dashboard } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const [symbols, setSymbols] = useState(["MSFT", "GOOGL", "AMZN"]);
  const { data, isFetching } = useQuery({ queryKey: ["compare", symbols], queryFn: () => compareCompanies(symbols), enabled: symbols.length >= 2 });
  const update = (index: number, symbol: string) => setSymbols((current) => current.map((item, itemIndex) => itemIndex === index ? symbol : item));
  return (
    <div className="page compare-page">
      <PageHeading eyebrow="Side by side" title="Compare the evidence" description="See which company is stronger today—and why—without turning the result into a trade signal." />
      <Card className="compare-selector"><div className="compare-select-grid">{symbols.map((symbol, index) => { const label = `Company ${index + 1}`; const id = `compare-company-${index + 1}`; return <label key={id} htmlFor={id}><span>{label}</span><select id={id} name={id} aria-label={label} data-testid={id} value={symbol} onChange={(event) => update(index, event.target.value)}>{dashboard?.companies.map((company) => <option key={company.symbol} value={company.symbol} disabled={symbols.includes(company.symbol) && company.symbol !== symbol}>{company.symbol} · {company.name}</option>)}</select></label>; })}</div><p><Info size={14} /> Select two or three companies from the current data catalog.</p></Card>
      {isFetching || !data ? <PageSkeleton compact /> : <>
        <section className="compare-company-heads"><div className="compare-label-spacer" />{data.symbols.map((symbol) => { const company = dashboard?.companies.find((item) => item.symbol === symbol); return company ? <div key={symbol}><span className="company-logo" style={{ background: company.accent }}>{symbol[0]}</span><strong>{company.name}</strong><small>{symbol}</small><HealthRing score={company.health} size={70} /></div> : null; })}</section>
        <Card className="comparison-table">{data.rows.map((row) => <div className="comparison-row" key={row.label}><strong>{row.label}</strong>{data.symbols.map((symbol) => <div key={symbol} className={row.winner === symbol ? "comparison-winner" : ""}>{row.values[symbol]}{row.winner === symbol && <Badge>Leader</Badge>}</div>)}</div>)}</Card>
        <section className="compare-conclusion"><span className="ai-orb"><Sparkles size={21} /></span><div><p className="eyebrow">Vitals conclusion</p><h2>{data.conclusion}</h2><p>Use this comparison to challenge or confirm your own thesis. It does not predict price performance.</p></div></section>
      </>}
      <Disclaimer />
    </div>
  );
}

function AlertRow({ alert, compact = false }: { alert: AlertItem; compact?: boolean }) {
  const Icon = alert.severity === "positive" ? CircleCheck : alert.severity === "attention" ? CircleAlert : Activity;
  return <Link to={`/company/${alert.symbol}`} className={cn("alert-row", compact && "alert-row-compact")}><span className={`alert-icon alert-${alert.severity}`}><Icon size={18} /></span><div><div className="alert-title-line"><strong>{alert.symbol} · {alert.title}</strong>{!alert.read && <i />}</div><p>{alert.reason}</p><small>{alert.time}</small></div>{alert.scoreChange && <strong className={alert.severity === "positive" ? "text-positive" : "text-negative"}>{alert.scoreChange}</strong>}<ArrowRight size={16} /></Link>;
}

interface LocalAlertRule { id: string; label: string; scope: string; enabled: boolean; custom?: boolean }

const ALERT_RULES_STORAGE_KEY = "invest-vitals:alert-rules:v1";
const DEFAULT_ALERT_RULES: LocalAlertRule[] = [
  { id: "health-below-70", label: "Health below 70", scope: "All portfolio holdings", enabled: true },
  { id: "momentum-negative", label: "Momentum turns negative", scope: "All portfolio holdings", enabled: true },
  { id: "revenue-below-10", label: "Revenue growth below 10%", scope: "All portfolio holdings", enabled: true },
  { id: "thesis-changes", label: "Thesis evidence changes", scope: "All portfolio holdings", enabled: true },
];

function readAlertRules(): LocalAlertRule[] {
  if (typeof window === "undefined") return DEFAULT_ALERT_RULES;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ALERT_RULES_STORAGE_KEY) ?? "null") as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => item && typeof item === "object" && typeof item.id === "string" && typeof item.label === "string" && typeof item.scope === "string" && typeof item.enabled === "boolean")) return DEFAULT_ALERT_RULES;
    return parsed as LocalAlertRule[];
  } catch {
    return DEFAULT_ALERT_RULES;
  }
}

function NewAlertDialog({ open, onClose, companies, onCreate }: { open: boolean; onClose: () => void; companies: Company[]; onCreate: (rule: LocalAlertRule) => void }) {
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("All portfolio holdings");

  useEffect(() => {
    if (open) { setLabel(""); setScope("All portfolio holdings"); }
  }, [open]);

  const create = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onCreate({ id: `custom-${Date.now()}`, label: trimmed, scope, enabled: true, custom: true });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create alert" description="Add a monitoring rule to this local workspace.">
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); create(); }}>
        <label className="field-label" htmlFor="alert-name"><span>Alert name</span><input id="alert-name" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Free cash flow weakens" autoFocus /></label>
        <label className="field-label" htmlFor="alert-scope"><span>Monitor</span><select id="alert-scope" value={scope} onChange={(event) => setScope(event.target.value)}><option>All portfolio holdings</option>{companies.map((company) => <option key={company.symbol} value={`${company.symbol} · ${company.name}`}>{company.symbol} · {company.name}</option>)}</select></label>
        <p className="modal-note"><Info size={15} /> This v1 rule is stored in your browser. Signal evaluation continues to use the illustrative dataset.</p>
        <div className="modal-actions"><span /><div><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!label.trim()}>Save alert</Button></div></div>
      </form>
    </Modal>
  );
}

function AlertsPage() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const [filter, setFilter] = useState<"all" | "attention" | "watch" | "positive">("all");
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [rules, setRules] = useState<LocalAlertRule[]>(readAlertRules);
  useEffect(() => {
    window.localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(rules));
  }, [rules]);
  const alerts = (data?.alerts ?? []).filter((alert) => filter === "all" || alert.severity === filter);
  return (
    <div className="page alerts-page">
      <PageHeading eyebrow="Signal center" title="Meaningful changes, filtered" description="Alerts highlight evidence that may affect your investment thesis—not ordinary market noise." actions={<Button variant="secondary" aria-haspopup="dialog" onClick={() => setNewAlertOpen(true)}><Plus size={16} /> New alert</Button>} />
      <div className="filter-tabs" role="tablist">{(["all", "attention", "watch", "positive"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item === "all" ? "All signals" : item}</button>)}</div>
      <Card className="alerts-list"><div className="alerts-date"><span>Today</span><i /></div>{alerts.length ? alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />) : <div className="empty-inline"><CircleCheck size={24} /><p>No alerts match this filter.</p></div>}</Card>
      <section className="alert-rules"><div className="section-heading"><div><p className="eyebrow">Monitoring</p><h2>Active rules</h2></div></div><div className="rule-grid">{rules.map((rule, index) => <Card key={rule.id} className={cn("rule-card", !rule.enabled && "rule-card-disabled")}><span className={index < 2 && !rule.custom ? "rule-icon rule-warn" : "rule-icon"}><Activity size={17} /></span><div><strong>{rule.label}</strong><small>{rule.scope}</small></div><div className="rule-actions"><button type="button" role="switch" aria-checked={rule.enabled} aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.label}`} className={cn("rule-toggle", rule.enabled && "toggle-on")} onClick={() => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item))}><i /></button>{rule.custom && <button type="button" className="rule-delete" aria-label={`Delete ${rule.label}`} onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))}><X size={15} /></button>}</div></Card>)}</div></section>
      <Disclaimer />
      <NewAlertDialog open={newAlertOpen} onClose={() => setNewAlertOpen(false)} companies={data?.companies ?? []} onCreate={(rule) => setRules((current) => [...current, rule])} />
    </div>
  );
}

interface ChatMessage { role: "user" | "assistant"; text: string; answer?: Awaited<ReturnType<typeof askAssistant>> }

function AssistantPage() {
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const mutation = useMutation({ mutationFn: askAssistant, onSuccess: (answer, question) => setMessages((current) => [...current, { role: "assistant", text: answer.answer, answer }]) });
  const submit = (question = input) => {
    const trimmed = question.trim();
    if (!trimmed || mutation.isPending) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setInput("");
    mutation.mutate(trimmed);
  };
  const prompts = ["Which holding worries you?", "Why did AAPL health fall?", "Compare MSFT and GOOGL", "What changed after earnings?"];
  return (
    <div className="page assistant-page">
      <PageHeading eyebrow="AI decision support" title="Ask Vitals" description="Get a clear answer grounded in the health model, fundamentals, and thesis evidence." actions={<Badge className="data-badge"><ShieldCheck size={13} /> No price predictions</Badge>} />
      <div className="assistant-layout">
        <Card className="chat-card">
          <div className="chat-scroll" aria-live="polite">
            {messages.length === 0 && <div className="assistant-welcome"><span className="ai-orb ai-orb-large"><Bot size={30} /></span><h2>What would you like to understand?</h2><p>I can explain a health change, compare holdings, surface risks, or translate an earnings update into plain English.</p><div className="prompt-grid">{prompts.map((prompt) => <button key={prompt} onClick={() => submit(prompt)}>{prompt}<ArrowRight size={15} /></button>)}</div></div>}
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={cn("chat-message", `chat-${message.role}`)}>{message.role === "assistant" && <span className="ai-orb"><Sparkles size={17} /></span>}<div><p>{message.text}</p>{message.answer && <><div className="answer-highlights">{message.answer.highlights.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div><div className="follow-ups">{message.answer.followUps.map((item) => <button key={item} onClick={() => submit(item)}>{item}</button>)}</div></>}</div></div>)}
            {mutation.isPending && <div className="chat-message chat-assistant"><span className="ai-orb"><Sparkles size={17} /></span><div className="typing"><i /><i /><i /></div></div>}
          </div>
          <form className="chat-input" onSubmit={(event) => { event.preventDefault(); submit(); }}><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} placeholder="Ask about a holding or recent change…" aria-label="Ask Vitals a question" /><Button type="submit" size="icon" aria-label="Send question" disabled={!input.trim() || mutation.isPending}><ArrowUp size={18} /></Button></form>
          <small className="chat-disclaimer">Vitals explains available evidence. It does not provide financial advice or predict future prices.</small>
        </Card>
        <aside className="assistant-context"><Card><span className="eyebrow">How answers work</span><h3>Evidence before opinion</h3><ol><li><span>1</span>Checks transparent health components</li><li><span>2</span>Finds the material change</li><li><span>3</span>Compares it with your thesis</li><li><span>4</span>Labels risks and unknowns</li></ol></Card><Card className="assistant-boundary"><ShieldCheck size={22} /><h3>Disciplined by design</h3><p>No buy/sell language. No future-price claims. No hidden score.</p></Card></aside>
      </div>
    </div>
  );
}

function Disclaimer() {
  return <p className="disclaimer"><Info size={13} /> Invest Vitals is an educational decision-support tool, not financial advice. Market prices and returns may be live or cached; fundamentals, valuation, thesis, and news remain baseline data unless labeled otherwise.</p>;
}

function PageSkeleton({ compact = false }: { compact?: boolean }) {
  return <div className={cn("page page-skeleton", compact && "skeleton-compact")}><div className="skeleton-line skeleton-kicker" /><div className="skeleton-line skeleton-title" /><div className="skeleton-line skeleton-copy" /><div className="skeleton-grid">{Array.from({ length: compact ? 3 : 6 }, (_, index) => <div key={index} className="skeleton-card" />)}</div></div>;
}

export default function App() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/company/:symbol" component={CompanyPage} />
        <Route path="/watchlist" component={WatchlistPage} />
        <Route path="/compare" component={ComparePage} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/assistant" component={AssistantPage} />
        <Route><Redirect to="/" replace /></Route>
      </Switch>
    </AppShell>
  );
}
