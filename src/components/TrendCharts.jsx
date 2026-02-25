import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';
import { formatDate } from '../utils/normalize';

/**
 * 7-day trend line chart for CPA, ROAS, CTR, or CPM
 */
export function TrendLineChart({ data, metric, label, color = '#8b5cf6', target = null, formatter = null }) {
  if (!data || data.length === 0) return <EmptyChart />;

  // Filter out data points where the metric is null/undefined (e.g. CPA when conversions=0)
  const chartData = data.filter(d => d[metric] != null);
  if (chartData.length === 0) return <EmptyChart />;

  const fmt = formatter || (v => typeof v === 'number' ? v.toFixed(2) : '—');

  return (
    <div className="card p-4">
      <div className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase mb-3">{label}</div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={v => formatDate(v)}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={fmt}
              width={45}
            />
            {target != null && (
              <ReferenceLine
                y={target}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: 'Target', fill: '#f59e0b', fontSize: 9, position: 'right' }}
              />
            )}
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
              labelFormatter={v => formatDate(v)}
              formatter={(value) => [fmt(value), label]}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${metric})`}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Compact sparkline for inline use in tables/cards
 */
export function Sparkline({ data, metric, color = '#8b5cf6', width = 100, height = 24 }) {
  const chartData = (data || []).filter(d => d[metric] != null);
  if (chartData.length < 2) return <span className="text-[var(--color-text-muted)]">—</span>;

  return (
    <div style={{ width, height }} className="inline-block">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey={metric}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Multi-metric trend comparison (overlay two metrics)
 */
export function DualTrendChart({ data, metrics, label }) {
  // For dual charts, keep rows where at least one metric is non-null
  const chartData = (data || []).filter(d => metrics.some(m => d[m.key] != null));
  if (chartData.length === 0) return <EmptyChart />;

  return (
    <div className="card p-4">
      <div className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase mb-3">{label}</div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => formatDate(v)} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={45} />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
              labelFormatter={v => formatDate(v)}
            />
            {metrics.map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 2, fill: m.color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-2 justify-center">
        {metrics.map(m => (
          <div key={m.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded" style={{ background: m.color }} />
            <span className="text-[10px] text-[var(--color-text-muted)]">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="card p-4">
      <div className="h-36 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
        Not enough data for chart
      </div>
    </div>
  );
}
