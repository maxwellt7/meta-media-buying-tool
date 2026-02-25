import { getVerdictColor, getVerdictBg } from '../utils/normalize';

export function VerdictBadge({ verdict }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold tracking-wider uppercase"
      style={{
        color: getVerdictColor(verdict),
        background: getVerdictBg(verdict),
        border: `1px solid ${getVerdictColor(verdict)}33`,
      }}
    >
      {verdict}
    </span>
  );
}

export function UrgencyDot({ urgency }) {
  const colors = { RED: '#ef4444', YELLOW: '#f59e0b', GREEN: '#22c55e' };
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: colors[urgency] || '#64748b' }}
    />
  );
}

export function HealthBadge({ score }) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const bg = score >= 80 ? '#22c55e18' : score >= 50 ? '#f59e0b18' : '#ef444418';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tabular-nums"
      style={{ color, background: bg, border: `1px solid ${color}33` }}
    >
      {score}
    </span>
  );
}

export function PriorityTag({ priority }) {
  const colors = {
    0: { color: '#ef4444', label: 'P0' },
    1: { color: '#22c55e', label: 'P1' },
    2: { color: '#f59e0b', label: 'P2' },
    3: { color: '#8b5cf6', label: 'P3' },
  };
  const p = colors[priority] || colors[3];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider"
      style={{ color: p.color, background: `${p.color}18`, border: `1px solid ${p.color}33` }}
    >
      {p.label}
    </span>
  );
}

export function MetricCard({ label, value, subValue, trend, trendColor, icon }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase">{label}</span>
        {icon && <span className="text-sm opacity-50">{icon}</span>}
      </div>
      <div className="text-xl font-bold text-[var(--color-text-primary)] tabular-nums">{value}</div>
      {(subValue || trend) && (
        <div className="flex items-center gap-2 mt-1">
          {subValue && <span className="text-xs text-[var(--color-text-secondary)]">{subValue}</span>}
          {trend && (
            <span className="text-xs font-medium" style={{ color: trendColor || '#94a3b8' }}>
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
