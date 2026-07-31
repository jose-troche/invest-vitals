# Invest Vitals – Product & Technical Specification (v1)

---

# Overview

**Invest Vitals** is an AI-powered investment dashboard that helps long-term investors monitor the health of their portfolio.

Unlike traditional finance websites that focus on prices and charts, Invest Vitals answers:

> **"Is this investment becoming stronger or weaker?"**

The application combines historical performance, company fundamentals, valuation, momentum, earnings, news, and AI reasoning into a simple dashboard that allows investors to understand every holding in seconds.

This is **not** a trading platform.

It is an AI portfolio monitoring and decision-support tool.

---

# Design Principles

The application should:

* prioritize clarity over quantity
* avoid overwhelming users
* provide "one glance" understanding
* explain *why* something changed
* support long-term investors
* use AI to summarize rather than replace data
* work equally well on desktop and mobile

---

# Tech Stack

Frontend

* React
* TypeScript
* Vite
* TailwindCSS
* shadcn/ui
* TanStack Query

Backend

* Cloudflare Workers
* Hono
* TypeScript

Storage

Cloudflare D1

Tables:

* portfolios
* holdings
* watchlists
* company_cache
* daily_prices
* earnings
* news
* alerts
* thesis
* ai_summaries

Cache

Cloudflare KV

Scheduled Jobs

Cloudflare Cron

Authentication

Cloudflare Access or Clerk (future)

Deploy

Cloudflare Workers

Everything should be deployable as a single Worker project.

---

# External Data Sources

Prefer free APIs.

Examples:

Prices

* Stooq
* Alpha Vantage
* TwelveData free tier
* Financial Modeling Prep (free endpoints)
* Yahoo Finance (unofficial)

Fundamentals

Financial Modeling Prep

News

NewsAPI
Finnhub
RSS feeds

SEC filings

SEC EDGAR

---

# Main Pages

## Dashboard

Landing page.

Shows every holding.

Example

```
----------------------------------------------------
Ticker   Health  Momentum  Value  Trend  Action
----------------------------------------------------

MSFT     92       ↑↑        Fair   Strong  Hold

AMZN     78       ↓         High   Flat    Review

GOOG     88       ↑         Fair   Strong  Hold

AAPL     74       →         High   Weak    Watch

META     96       ↑↑        Fair   Strong  Buy More
```

Everything should be sortable.

---

## Portfolio Summary

Cards

Portfolio Value

Today's change

1 month

6 month

YTD

1 year

5 years

Average Health

Average Momentum

Portfolio Risk

Diversification Score

Largest Winner

Largest Loser

---

## Company Detail Page

Header

```
Microsoft

Health Score
92/100

Recommendation

Hold

Last Updated

Today
```

Sections

---

### Performance

Small cards

```
1 Month

+3%

3 Months

+12%

6 Months

+18%

1 Year

+5%

3 Years

+74%

5 Years

+201%
```

No large charts at first.

Small sparkline beside each.

---

### Annual Returns

```
2021 +41%

2022 -27%

2023 +54%

2024 +31%

2025 +22%

2026 +6%
```

Green/red bars.

---

### Momentum

Display

Strong Uptrend

or

Losing Momentum

or

Recovering

Explain why.

---

### Fundamentals

Revenue Growth

EPS Growth

Operating Margin

Gross Margin

Free Cash Flow

Debt

Cash

ROE

ROIC

Every metric gets

green

yellow

red

---

### Valuation

PE

Forward PE

PEG

Price/Sales

EV/EBITDA

Compared against

* company's history
* sector average

---

### AI Summary

Generated after earnings.

Example

```
Revenue increased 18%.

Cloud business accelerated.

Margins improved.

Management raised guidance.

AI investments continue to pay off.

Overall the investment thesis remains intact.
```

---

### Investment Thesis

User editable.

Example

```
Bought because

Cloud leadership

AI leadership

Strong cash flow

Excellent management

Long-term compounder
```

---

AI compares future earnings against this thesis.

---

### Recent News

Top headlines

AI summarizes:

"This is probably noise."

"This materially affects the business."

---

# Health Score

The most important feature.

Score

0-100

Example weighting

Performance (20%)

Momentum (15%)

Revenue Growth (15%)

EPS Growth (15%)

Cash Flow (10%)

Margins (10%)

Debt (10%)

Valuation (5%)

News Sentiment (5%)

Every component visible.

No black box.

---

# Momentum Score

Instead of RSI.

Use

1 month

3 month

6 month

1 year

weighted trend.

Return

Strong Uptrend

Uptrend

Flat

Weak

Downtrend

Recovering

---

# Alerts

User configurable.

Examples

Revenue growth below 10%

EPS declines

Price drops 15%

Health score below 70

Momentum becomes negative

Valuation becomes expensive

Debt rises significantly

Analyst estimates reduced

Investment thesis broken

Alert page

```
Yesterday

Microsoft

Health dropped

92→84

Reason

Margins compressed after earnings.
```

---

# AI Assistant

Chat window.

Questions

"Why did MSFT health fall?"

"Compare Microsoft and Amazon."

"Which holding worries you?"

"What changed after earnings?"

"Explain this in simple English."

---

# Watchlist

Companies not owned.

Same health score.

Sortable.

---

# Compare Companies

Select

MSFT

GOOG

AMZN

Shows

Health

Momentum

Growth

Valuation

Risk

AI conclusion.

---

# Daily Background Jobs

Every morning

Update prices.

Every earnings release

Update financials.

Every hour

Check news.

Recompute

Health scores.

Generate AI summaries.

Trigger alerts.

---

# Nice Visualizations

Instead of giant charts.

## Performance Timeline

```
5Y

██████████

+210%

3Y

██████

+88%

1Y

█

+4%

6M

░░

-2%

3M

░

-4%
```

---

## Heatmap

```
5Y 🟢

3Y 🟢

1Y 🟡

6M 🔴

3M 🔴

1M 🟢
```

---

## Health Ring

```
92

Excellent
```

Circular progress.

---

## Vitals

```
Revenue

★★★★★

Margins

★★★★☆

Debt

★★★★★

Momentum

★★★☆☆

Valuation

★★☆☆☆

News

★★★★☆
```

---

# AI Prompt Examples

Given:

Latest earnings

Financial ratios

News

Historical metrics

User investment thesis

Generate

* 150-word summary
* health explanation
* risks
* positives
* thesis changes
* recommendation

Never predict future prices.

Never say Buy/Sell.

Use

Healthy

Watch

Needs Review

instead.

---

# Future Features

Portfolio import

Broker integrations

Email alerts

SMS

Push notifications

Dividend tracking

Sector analysis

Macro dashboard

Economic calendar

Insider trading

Institutional ownership

Options activity

Tax lots

Rebalancing suggestions

---

# UI Theme

Minimal.

Lots of whitespace.

Inspired by:

* Apple Health
* Linear
* Arc Browser
* Notion
* Stripe Dashboard

Avoid clutter.

Every page should answer:

> **"What changed?"**

before

> **"Show me everything."**

---

# Success Criteria

A user should be able to open the dashboard and, within **30 seconds**, answer:

* Which holdings are healthiest?
* Which holdings have weakening momentum?
* Which companies deserve attention today?
* Has my investment thesis changed for any holding?
* Are there any meaningful alerts?
* Do I need to read any earnings reports, or can the AI summaries suffice for now?

The application should feel less like a stock screener and more like a **personal AI investment analyst**—one that filters out noise, highlights what matters, and helps investors stay disciplined over the long term without encouraging short-term trading. Given your experience building scalable systems and AI-driven applications, this architecture is also well suited to evolve over time with additional data sources, richer analytics, and more sophisticated AI reasoning while remaining deployable on Cloudflare's serverless platform.
