import type { AnnualReturn } from "@invest-vitals/domain";

export function Sparkline({ values, positive = true, width = 116, height = 38 }: { values: number[]; positive?: boolean; width?: number; height?: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${positive ? "Positive" : "Negative"} performance trend`}>
      <polyline points={points} fill="none" stroke={positive ? "#3f7d5a" : "#b95c52"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HealthRing({ score, size = 76 }: { score: number; size?: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 85 ? "#3f7d5a" : score >= 72 ? "#b38435" : "#b95c52";
  return (
    <div className="health-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} className="health-ring-track" />
        <circle cx="50" cy="50" r={radius} className="health-ring-value" style={{ stroke: color, strokeDasharray: circumference, strokeDashoffset: offset }} />
      </svg>
      <strong>{score}</strong>
    </div>
  );
}

export function AnnualReturns({ returns }: { returns: AnnualReturn[] }) {
  const max = Math.max(...returns.map((item) => Math.abs(item.returnPct)), 1);
  return (
    <div className="annual-chart">
      {returns.map((item) => (
        <div className="annual-row" key={item.year}>
          <span>{item.year}</span>
          <div className="annual-track"><i className={item.returnPct >= 0 ? "positive-bar" : "negative-bar"} style={{ width: `${Math.max(8, Math.abs(item.returnPct) / max * 100)}%` }} /></div>
          <strong className={item.returnPct >= 0 ? "text-positive" : "text-negative"}>{item.returnPct > 0 ? "+" : ""}{item.returnPct}%</strong>
        </div>
      ))}
    </div>
  );
}
