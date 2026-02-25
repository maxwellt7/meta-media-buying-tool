import { useState } from 'react';
import { formatCurrency, formatROAS, formatPercent, getHealthColor } from '../utils/normalize';
import { HealthBadge, VerdictBadge } from '../components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function CreativeLab({ data }) {
  const [sortBy, setSortBy] = useState('healthScore');
  const [filterVerdict, setFilterVerdict] = useState('all');

  const { adVerdicts, summary } = data;

  // Sort ads
  const sortedAds = [...adVerdicts].sort((a, b) => {
    if (sortBy === 'healthScore') return (b.healthScore || 0) - (a.healthScore || 0);
    if (sortBy === 'spend') return (b.spend || 0) - (a.spend || 0);
    if (sortBy === 'roas') return (b.roas || 0) - (a.roas || 0);
    if (sortBy === 'ctr') return (b.ctr || 0) - (a.ctr || 0);
    return 0;
  });

  const filteredAds = filterVerdict === 'all'
    ? sortedAds
    : sortedAds.filter(a => a.verdict === filterVerdict);

  // Creative health distribution
  const healthDist = {
    green: adVerdicts.filter(a => a.healthScore >= 80).length,
    yellow: adVerdicts.filter(a => a.healthScore >= 50 && a.healthScore < 80).length,
    red: adVerdicts.filter(a => a.healthScore < 50).length,
  };

  // Format performance by implied creative type (from name patterns)
  const formatPerf = getFormatPerformance(adVerdicts);

  return (
    <div className="space-y-6">
      {/* Overview Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{adVerdicts.length}</div>
          <div className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase mt-1">Total Creatives</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: summary.avgCreativeHealth >= 80 ? '#22c55e' : summary.avgCreativeHealth >= 50 ? '#f59e0b' : '#ef4444' }}>
            {summary.avgCreativeHealth || '—'}
          </div>
          <div className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase mt-1">Avg Health Score</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-[#22c55e]">{healthDist.green}</div>
              <div className="text-[9px] text-[#22c55e]">Healthy</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[#f59e0b]">{healthDist.yellow}</div>
              <div className="text-[9px] text-[#f59e0b]">Caution</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[#ef4444]">{healthDist.red}</div>
              <div className="text-[9px] text-[#ef4444]">Critical</div>
            </div>
          </div>
          <div className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase mt-2 text-center">Distribution</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[#ef4444]">
            {adVerdicts.filter(a => a.verdict === 'KILL').length}
          </div>
          <div className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase mt-1">Needs Attention</div>
        </div>
      </div>

      {/* Format Performance Comparison */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase mb-4">
          Performance by Creative Format
        </h3>
        {formatPerf.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formatPerf} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="format" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }}
                />
                <Bar dataKey="avgHealth" name="Avg Health Score" radius={[4, 4, 0, 0]}>
                  {formatPerf.map((entry, i) => (
                    <Cell key={i} fill={getHealthColor(entry.avgHealth)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Not enough data to compare formats
          </div>
        )}
      </div>

      {/* Creative Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
            Creative Scorecards
          </h3>
          <div className="flex items-center gap-3">
            {/* Filter */}
            <select
              value={filterVerdict}
              onChange={e => setFilterVerdict(e.target.value)}
              className="text-xs bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-secondary)] outline-none"
            >
              <option value="all">All Verdicts</option>
              <option value="KILL">Kill</option>
              <option value="SCALE">Scale</option>
              <option value="ITERATE">Iterate</option>
              <option value="NEW CONCEPT">New Concept</option>
              <option value="MONITOR">Monitor</option>
            </select>
            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-xs bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-secondary)] outline-none"
            >
              <option value="healthScore">Sort: Health Score</option>
              <option value="spend">Sort: Spend</option>
              <option value="roas">Sort: ROAS</option>
              <option value="ctr">Sort: CTR</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filteredAds.map(ad => (
            <div
              key={ad.id}
              className="card p-4 border-l-[3px] hover:bg-[#1e293b22] transition-colors"
              style={{ borderLeftColor: getHealthColor(ad.healthScore || 0) }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <HealthBadge score={ad.healthScore} />
                    <VerdictBadge verdict={ad.verdict} />
                  </div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{ad.name}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                    {ad.adSetName} · {ad.campaignName}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-5 gap-2 mt-3 pt-3 border-t border-[#1e293b44]">
                <MiniMetric label="Spend" value={formatCurrency(ad.spend)} />
                <MiniMetric label="ROAS" value={formatROAS(ad.roas)} color={ad.roas >= 3 ? '#22c55e' : '#ef4444'} />
                <MiniMetric label="CPA" value={formatCurrency(ad.cpa)} />
                <MiniMetric label="CTR" value={formatPercent(ad.ctr, 2)} />
                <MiniMetric label="Freq" value={ad.frequency?.toFixed(1)} color={ad.frequency > 2.5 ? '#f59e0b' : null} />
              </div>

              {/* Hook / Hold (if video) */}
              {(ad.hookRate != null || ad.holdRate != null) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {ad.hookRate != null && (
                    <MiniMetric label="Hook Rate" value={formatPercent(ad.hookRate, 1)} color={ad.hookRate >= 0.30 ? '#22c55e' : '#ef4444'} />
                  )}
                  {ad.holdRate != null && (
                    <MiniMetric label="Hold Rate" value={formatPercent(ad.holdRate, 1)} color={ad.holdRate >= 0.40 ? '#22c55e' : '#ef4444'} />
                  )}
                </div>
              )}

              {/* Top signal */}
              {ad.topSignal && (
                <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                  ↳ {ad.topSignal.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }) {
  return (
    <div>
      <div className="text-[9px] text-[var(--color-text-muted)] uppercase">{label}</div>
      <div className="text-[11px] font-medium tabular-nums" style={{ color: color || 'var(--color-text-primary)' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function getFormatPerformance(ads) {
  const formats = {};

  ads.forEach(ad => {
    const name = (ad.name || '').toLowerCase();
    let format = 'Other';
    if (name.includes('ugc') || name.includes('testimonial')) format = 'UGC';
    else if (name.includes('carousel')) format = 'Carousel';
    else if (name.includes('reel')) format = 'Reels';
    else if (name.includes('video') || name.includes('3 reasons')) format = 'Video';
    else if (name.includes('static') || name.includes('hero')) format = 'Static';
    else if (name.includes('dpa') || name.includes('dynamic')) format = 'Dynamic';

    if (!formats[format]) formats[format] = { totalHealth: 0, count: 0, totalRoas: 0, totalCtr: 0 };
    formats[format].totalHealth += ad.healthScore || 0;
    formats[format].totalRoas += ad.roas || 0;
    formats[format].totalCtr += ad.ctr || 0;
    formats[format].count++;
  });

  return Object.entries(formats)
    .map(([format, data]) => ({
      format,
      avgHealth: Math.round(data.totalHealth / data.count),
      avgRoas: +(data.totalRoas / data.count).toFixed(2),
      avgCtr: +(data.totalCtr / data.count).toFixed(2),
      count: data.count,
    }))
    .sort((a, b) => b.avgHealth - a.avgHealth);
}
