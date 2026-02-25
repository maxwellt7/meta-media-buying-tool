import { useState } from 'react';
import { formatCurrency, formatROAS, formatPercent, formatCompact, getVerdictColor, getCampaignTypeInfo } from '../utils/normalize';
import { VerdictBadge, HealthBadge } from '../components/StatusBadge';

export default function CampaignDive({ data }) {
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [expandedAdSet, setExpandedAdSet] = useState(null);

  const { campaignVerdicts, adSetVerdicts, adVerdicts } = data;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold tracking-wider text-[var(--color-text-primary)] uppercase">
          Campaign Performance
        </h2>
        <div className="text-xs text-[var(--color-text-muted)]">
          {campaignVerdicts.length} campaigns
        </div>
      </div>

      {campaignVerdicts.map(campaign => {
        const typeInfo = getCampaignTypeInfo(campaign.funnelCategory);
        const isExpanded = expandedCampaign === campaign.id;
        const campaignAdSets = adSetVerdicts.filter(as => as.campaignId === campaign.id);

        return (
          <div key={campaign.id} className="card overflow-hidden">
            {/* Campaign Header */}
            <div
              className="p-4 cursor-pointer hover:bg-[#1e293b33] transition-colors border-l-[3px]"
              style={{ borderLeftColor: getVerdictColor(campaign.verdict) }}
              onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <VerdictBadge verdict={campaign.verdict} />
                  <span
                    className="text-[10px] px-2 py-0.5 rounded tracking-wider font-medium"
                    style={{ color: typeInfo.color, background: typeInfo.bgColor, border: `1px solid ${typeInfo.color}33` }}
                  >
                    {typeInfo.label}
                  </span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {campaign.name}
                  </span>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <MetricCell label="Spend" value={formatCurrency(campaign.spend, 'USD', true)} />
                  <MetricCell label="ROAS" value={formatROAS(campaign.roas)} color={campaign.roas >= (data.thresholds?.profile?.targetROAS || 3) ? '#22c55e' : '#ef4444'} />
                  <MetricCell label="CPA" value={formatCurrency(campaign.cpa)} color={campaign.cpa && campaign.cpa <= (data.thresholds?.profile?.targetCPA || 30) ? '#22c55e' : '#ef4444'} />
                  <MetricCell label="CTR" value={formatPercent(campaign.ctr, 2)} />
                  <MetricCell label="Freq" value={campaign.frequency?.toFixed(1)} color={campaign.frequency > 2.5 ? '#f59e0b' : '#94a3b8'} />
                  <MetricCell label="Conv" value={formatCompact(campaign.conversions)} />
                  <span className="text-[var(--color-text-muted)] text-lg">{isExpanded ? '▾' : '▸'}</span>
                </div>
              </div>
              {/* Top signal reason */}
              {campaign.topSignal && (
                <div className="mt-2 text-xs text-[var(--color-text-secondary)] pl-1">
                  ↳ {campaign.topSignal.reason}
                </div>
              )}
            </div>

            {/* Expanded: Ad Sets */}
            {isExpanded && (
              <div className="border-t border-[var(--color-border)]">
                {campaignAdSets.length === 0 && (
                  <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">
                    No ad sets found
                  </div>
                )}
                {campaignAdSets.map(adSet => {
                  const isAdSetExpanded = expandedAdSet === adSet.id;
                  const adSetAds = adVerdicts.filter(a => a.adSetId === adSet.id);

                  return (
                    <div key={adSet.id}>
                      {/* Ad Set Row */}
                      <div
                        className="px-4 py-3 pl-8 cursor-pointer hover:bg-[#1e293b22] transition-colors border-l-[3px] ml-4 border-b border-[#1e293b33]"
                        style={{ borderLeftColor: getVerdictColor(adSet.verdict) }}
                        onClick={() => setExpandedAdSet(isAdSetExpanded ? null : adSet.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <VerdictBadge verdict={adSet.verdict} />
                            <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                              {adSet.name}
                            </span>
                            {adSet.conversionsLast7d < 50 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f59e0b18] text-[#f59e0b] border border-[#f59e0b33]">
                                Learning
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-5 shrink-0">
                            <MetricCell label="Spend" value={formatCurrency(adSet.spend)} size="sm" />
                            <MetricCell label="ROAS" value={formatROAS(adSet.roas)} size="sm" />
                            <MetricCell label="CPA" value={formatCurrency(adSet.cpa)} size="sm" />
                            <MetricCell label="Freq" value={adSet.frequency?.toFixed(1)} size="sm" />
                            <MetricCell label="Conv/wk" value={adSet.conversionsLast7d} size="sm" />
                            <span className="text-[var(--color-text-muted)] text-sm">{isAdSetExpanded ? '▾' : '▸'}</span>
                          </div>
                        </div>
                        {adSet.topSignal && (
                          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] pl-1">
                            ↳ {adSet.topSignal.reason}
                          </div>
                        )}
                      </div>

                      {/* Expanded: Ads */}
                      {isAdSetExpanded && (
                        <div className="ml-12 border-l border-[var(--color-border)]">
                          {adSetAds.map(ad => (
                            <div
                              key={ad.id}
                              className="px-4 py-2.5 flex items-center justify-between border-b border-[#1e293b22] hover:bg-[#1e293b11]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <HealthBadge score={ad.healthScore} />
                                <VerdictBadge verdict={ad.verdict} />
                                <span className="text-xs text-[var(--color-text-primary)] truncate">
                                  {ad.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <MetricCell label="Spend" value={formatCurrency(ad.spend)} size="xs" />
                                <MetricCell label="ROAS" value={formatROAS(ad.roas)} size="xs" />
                                <MetricCell label="CPA" value={formatCurrency(ad.cpa)} size="xs" />
                                <MetricCell label="CTR" value={formatPercent(ad.ctr, 2)} size="xs" />
                                {ad.hookRate != null && (
                                  <MetricCell label="Hook" value={formatPercent(ad.hookRate, 1)} size="xs" color={ad.hookRate >= 0.30 ? '#22c55e' : '#ef4444'} />
                                )}
                              </div>
                            </div>
                          ))}
                          {adSetAds.length === 0 && (
                            <div className="px-4 py-3 text-xs text-[var(--color-text-muted)]">No ads</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricCell({ label, value, color, size = 'md' }) {
  const textSizes = { xs: 'text-[10px]', sm: 'text-[11px]', md: 'text-xs' };
  const valueSizes = { xs: 'text-[11px]', sm: 'text-xs', md: 'text-sm' };
  return (
    <div className="text-right">
      <div className={`${textSizes[size]} text-[var(--color-text-muted)]`}>{label}</div>
      <div className={`${valueSizes[size]} font-medium tabular-nums`} style={{ color: color || 'var(--color-text-primary)' }}>
        {value || '—'}
      </div>
    </div>
  );
}
