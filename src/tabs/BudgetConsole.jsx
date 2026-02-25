import { formatCurrency } from '../utils/normalize';
import { minDailyBudget } from '../utils/metrics';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function BudgetConsole({ data }) {
  const { budgetAnalysis, adSetVerdicts, campaignVerdicts, summary } = data;
  const thresholds = data.thresholds || {};
  const targetCPA = thresholds.profile?.targetCPA || 30;
  const minBudget = minDailyBudget(targetCPA);

  // Budget allocation pie data
  const pieData = budgetAnalysis ? [
    { name: 'Prospecting', value: budgetAnalysis.actual.prospecting, color: '#0ea5e9' },
    { name: 'Retargeting', value: budgetAnalysis.actual.retargeting, color: '#f59e0b' },
    { name: 'Testing', value: budgetAnalysis.actual.testing, color: '#8b5cf6' },
  ].filter(d => d.value > 0) : [];

  // Learning phase data
  const adSetsWithLearning = adSetVerdicts.map(as => ({
    ...as,
    learningScore: Math.min(1, as.conversionsLast7d / 50),
    isLearning: as.conversionsLast7d < 50,
  }));

  return (
    <div className="space-y-6">
      {/* Budget Allocation */}
      <div className="grid grid-cols-[1fr_1.5fr] gap-6">
        {/* Pie Chart */}
        <div className="card p-5">
          <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase mb-4">
            Budget Allocation
          </h3>
          {pieData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
              No budget data available
            </div>
          )}
        </div>

        {/* Allocation vs Target */}
        <div className="card p-5">
          <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase mb-4">
            Allocation vs 70/20/10 Target
          </h3>
          {budgetAnalysis ? (
            <div className="space-y-4">
              {['prospecting', 'retargeting', 'testing'].map(category => {
                const actualPct = budgetAnalysis.actualPct[category];
                const targetPct = budgetAnalysis.target[category];
                const deviation = budgetAnalysis.deviations[category];
                const isOver = deviation > 0;
                const isAlert = Math.abs(deviation) > 0.10;
                const barColor = category === 'prospecting' ? '#0ea5e9' : category === 'retargeting' ? '#f59e0b' : '#8b5cf6';

                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--color-text-primary)] capitalize font-medium">{category}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs tabular-nums text-[var(--color-text-primary)]">
                          {(actualPct * 100).toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          target: {(targetPct * 100).toFixed(0)}%
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: isAlert ? '#ef4444' : '#22c55e' }}>
                          {isOver ? '+' : ''}{(deviation * 100).toFixed(0)}pp
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="relative h-3 bg-[#1e293b] rounded-full overflow-hidden">
                      <div
                        className="absolute h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, actualPct * 100)}%`, background: barColor }}
                      />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-white/30"
                        style={{ left: `${targetPct * 100}%` }}
                      />
                    </div>
                    <div className="text-right text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {formatCurrency(budgetAnalysis.actual[category])} of {formatCurrency(budgetAnalysis.totalSpend)}
                    </div>
                  </div>
                );
              })}

              {budgetAnalysis.hasAlert && (
                <div className="p-3 rounded-lg bg-[#ef444411] border border-[#ef444433] text-xs text-[#f87171] mt-2">
                  ⚠ Budget allocation deviates &gt;10pp from recommended 70/20/10 split. Consider rebalancing.
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-[var(--color-text-muted)] text-center py-8">No data</div>
          )}
        </div>
      </div>

      {/* Learning Phase Tracker */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
            Learning Phase Tracker
          </h3>
          <div className="text-xs text-[var(--color-text-muted)]">
            {summary.adSetsExitedLearning}/{summary.totalAdSets} ad sets exited learning
          </div>
        </div>

        <div className="space-y-2">
          {adSetsWithLearning.map(adSet => (
            <div key={adSet.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-[#1e293b22]">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">{adSet.name}</div>
                <div className="text-[10px] text-[var(--color-text-muted)] truncate">{adSet.campaignName}</div>
              </div>
              <div className="w-36">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {adSet.conversionsLast7d}/50
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: adSet.isLearning ? '#f59e0b' : '#22c55e' }}>
                    {adSet.isLearning ? 'Learning' : 'Exited'}
                  </span>
                </div>
                <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, adSet.learningScore * 100)}%`,
                      background: adSet.isLearning ? '#f59e0b' : '#22c55e',
                    }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0 w-20">
                <div className="text-[10px] text-[var(--color-text-muted)]">Min budget</div>
                <div className="text-xs font-medium tabular-nums text-[var(--color-text-primary)]">
                  {formatCurrency(minBudget)}/day
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scale Readiness */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase mb-4">
          Scaling Readiness
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {campaignVerdicts.map(campaign => {
            const checks = [
              { label: 'Stable 7+ days', pass: campaign.daysStable >= 7 },
              { label: 'ROAS above target', pass: campaign.roas >= (thresholds.profile?.targetROAS || 3) },
              { label: 'Frequency < 2.5', pass: campaign.frequency < 2.5 },
              { label: '8+ conv/day', pass: campaign.dailyConversions >= 8 },
              { label: 'Exited learning', pass: campaign.conversionsLast7d >= 50 },
            ];
            const passCount = checks.filter(c => c.pass).length;
            const isReady = passCount >= 4;

            return (
              <div key={campaign.id} className="p-4 rounded-lg bg-[#1e293b33] border border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">{campaign.name}</div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-bold tracking-wider"
                    style={{
                      color: isReady ? '#22c55e' : '#f59e0b',
                      background: isReady ? '#22c55e18' : '#f59e0b18',
                    }}
                  >
                    {isReady ? 'SCALE READY' : 'NOT READY'}
                  </span>
                </div>
                <div className="space-y-1">
                  {checks.map((check, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span>{check.pass ? '✅' : '❌'}</span>
                      <span className={check.pass ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
                {isReady && (
                  <div className="mt-3 pt-2 border-t border-[#1e293b44] text-[11px] text-[#22c55e]">
                    ↳ Recommend: Increase budget from {formatCurrency(campaign.dailyBudget || 0)} → {formatCurrency((campaign.dailyBudget || 0) * 1.2)} (+20%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
