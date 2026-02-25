import { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatROAS, formatPercent, formatCompact, getTrendIcon, getTrendColor, calculateTrend } from '../utils/normalize';
import { VerdictBadge, UrgencyDot, PriorityTag, MetricCard } from '../components/StatusBadge';
import HealthGauge from '../components/HealthGauge';
import { TrendLineChart, DualTrendChart } from '../components/TrendCharts';
import { generateDailyBriefing } from '../services/claude';

export default function CommandCenter({ data }) {
  const { actions, overallHealth, accountInsights, summary, budgetAnalysis } = data;
  const hasData = accountInsights && (accountInsights.spend > 0 || accountInsights.impressions > 0);
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const briefingRequestedRef = useRef(false);

  // Generate briefing once on mount
  useEffect(() => {
    if (data && !briefingRequestedRef.current) {
      briefingRequestedRef.current = true;
      let cancelled = false;
      generateDailyBriefing(data).then(text => {
        if (!cancelled) {
          setBriefing(text);
          setBriefingLoading(false);
        }
      });
      return () => { cancelled = true; };
    }
  }, [data]);

  // Calculate trends from daily data
  const spendTrend = accountInsights?.daily ? calculateTrend(accountInsights.daily, 'spend', 3) : null;
  const roasTrend = accountInsights?.daily ? calculateTrend(accountInsights.daily, 'roas', 3) : null;
  const cpaTrend = accountInsights?.daily ? calculateTrend(accountInsights.daily, 'cpa', 3) : null;

  return (
    <div className="space-y-6">
      {/* Top Row: Health Score + Quick Stats */}
      <div className="grid grid-cols-[200px_1fr] gap-6">
        {/* Health Gauge */}
        <div className="card p-6 flex items-center justify-center">
          <HealthGauge score={overallHealth} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            label="Total Spend"
            value={hasData ? formatCurrency(accountInsights?.spend, 'USD', true) : '—'}
            subValue={accountInsights?.dateStart ? `${accountInsights.dateStart} – ${accountInsights.dateStop}` : ''}
            trend={spendTrend ? `${getTrendIcon(spendTrend.direction)} ${spendTrend.change?.toFixed(1)}%` : null}
            trendColor={spendTrend ? getTrendColor(spendTrend.direction, true) : null}
            icon="💰"
          />
          <MetricCard
            label="Blended ROAS"
            value={formatROAS(accountInsights?.roas)}
            subValue={`Target: ${formatROAS(data.thresholds?.profile?.targetROAS)}`}
            trend={roasTrend ? `${getTrendIcon(roasTrend.direction)} ${roasTrend.change?.toFixed(1)}%` : null}
            trendColor={roasTrend ? getTrendColor(roasTrend.direction) : null}
            icon="📈"
          />
          <MetricCard
            label="Blended CPA"
            value={formatCurrency(accountInsights?.cpa)}
            subValue={`Target: ${formatCurrency(data.thresholds?.profile?.targetCPA)}`}
            trend={cpaTrend ? `${getTrendIcon(cpaTrend.direction)} ${cpaTrend.change?.toFixed(1)}%` : null}
            trendColor={cpaTrend ? getTrendColor(cpaTrend.direction, true) : null}
            icon="🎯"
          />
          <MetricCard
            label="Conversions"
            value={formatCompact(accountInsights?.conversions)}
            subValue={`${formatCompact(accountInsights?.clicks)} clicks`}
            trend={`CTR: ${formatPercent(accountInsights?.ctr, 2)}`}
            icon="⚡"
          />
        </div>
      </div>

      {/* Signal Summary Bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-xs tracking-wider text-[var(--color-text-muted)] uppercase">Signals</span>
            <div className="flex items-center gap-4">
              {[
                { label: 'Kill', count: summary.killCount, color: '#ef4444' },
                { label: 'Scale', count: summary.scaleCount, color: '#22c55e' },
                { label: 'Iterate', count: summary.iterateCount, color: '#f59e0b' },
                { label: 'New Concept', count: summary.newConceptCount, color: '#8b5cf6' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs font-medium" style={{ color: s.color }}>{s.count}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {summary.totalCampaigns} campaigns · {summary.totalAdSets} ad sets · {summary.totalAds} ads
          </div>
        </div>
      </div>

      {/* Trend Charts */}
      {accountInsights?.daily && accountInsights.daily.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <TrendLineChart
            data={accountInsights.daily}
            metric="cpa"
            label="CPA Trend (7d)"
            color="#ef4444"
            target={data.thresholds?.profile?.targetCPA}
            lowerIsBetter
            formatter={v => `$${Number(v).toFixed(0)}`}
          />
          <TrendLineChart
            data={accountInsights.daily}
            metric="roas"
            label="ROAS Trend (7d)"
            color="#22c55e"
            target={data.thresholds?.profile?.targetROAS}
            formatter={v => `${Number(v).toFixed(2)}×`}
          />
          <DualTrendChart
            data={accountInsights.daily}
            label="CTR & CPM Trend"
            metrics={[
              { key: 'ctr', label: 'CTR (%)', color: '#0ea5e9' },
              { key: 'cpm', label: 'CPM ($)', color: '#f59e0b' },
            ]}
          />
          <TrendLineChart
            data={accountInsights.daily}
            metric="spend"
            label="Daily Spend"
            color="#8b5cf6"
            formatter={v => `$${Number(v).toFixed(0)}`}
          />
        </div>
      )}

      {/* AI Daily Briefing */}
      <div className="card p-5" style={{ borderLeft: '3px solid var(--color-primary)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
            🤖 AI Daily Briefing
          </h3>
          <button
            onClick={() => { setBriefing(null); setBriefingLoading(true); generateDailyBriefing(data).then(t => { setBriefing(t); setBriefingLoading(false); }); }}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ↻ Regenerate
          </button>
        </div>
        {briefingLoading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <div className="w-3 h-3 border border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            Generating briefing...
          </div>
        ) : (
          <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
            {briefing}
          </div>
        )}
      </div>

      {/* Priority Action Queue */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 tracking-wider uppercase">
          Priority Action Queue
        </h3>
        <div className="space-y-2">
          {actions.length === 0 && (
            <div className="card p-8 text-center text-[var(--color-text-muted)] text-sm">
              No actionable signals detected. All campaigns are within target thresholds. ✅
            </div>
          )}
          {actions.slice(0, 10).map((action, i) => (
            <div
              key={i}
              className="card p-4 border-l-[3px] hover:bg-[#1e293b33] transition-colors"
              style={{ borderLeftColor: action.urgency === 'RED' ? '#ef4444' : action.urgency === 'YELLOW' ? '#f59e0b' : '#22c55e' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <PriorityTag priority={action.priority} />
                    <VerdictBadge verdict={action.signal} />
                    <UrgencyDot urgency={action.urgency} />
                    <span className="text-xs text-[var(--color-text-muted)] capitalize">{action.entityType}</span>
                  </div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {action.entityName}
                    {action.campaignName && action.entityType !== 'campaign' && (
                      <span className="text-[var(--color-text-muted)] font-normal"> · {action.campaignName}</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mb-2 leading-relaxed">
                    {action.reason}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs">
                      <span className="text-[var(--color-text-muted)]">Action: </span>
                      <span className="text-[var(--color-text-primary)]">{action.action}</span>
                    </div>
                  </div>
                  {action.expectedImpact && (
                    <div className="text-[11px] text-[var(--color-accent)] mt-1.5">
                      ↳ Expected impact: {action.expectedImpact}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget Allocation Quick View */}
      {budgetAnalysis && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase mb-3">
            Budget Allocation vs 70/20/10 Target
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {['prospecting', 'retargeting', 'testing'].map(category => {
              const actualPct = (budgetAnalysis.actualPct[category] * 100).toFixed(0);
              const targetPct = (budgetAnalysis.target[category] * 100).toFixed(0);
              const deviation = budgetAnalysis.deviations[category];
              const deviationColor = Math.abs(deviation) > 0.10 ? '#ef4444' : '#22c55e';
              return (
                <div key={category} className="flex items-center justify-between p-3 rounded-lg bg-[#1e293b33]">
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] capitalize">{category}</div>
                    <div className="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                      {actualPct}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--color-text-muted)]">Target: {targetPct}%</div>
                    <div className="text-xs font-medium" style={{ color: deviationColor }}>
                      {deviation > 0 ? '+' : ''}{(deviation * 100).toFixed(0)}pp
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
