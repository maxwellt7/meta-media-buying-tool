/**
 * Data Normalization Layer
 * Standardizes raw GoMarble data for the decision engine and dashboard.
 */

// ─── Currency Formatting ─────────────────────────────────────────────────────

export function formatCurrency(value, currency = 'USD', compact = false) {
  if (value == null || isNaN(value)) return '—';
  if (compact && Math.abs(value) >= 1000) {
    const suffixes = ['', 'K', 'M', 'B'];
    const tier = Math.floor(Math.log10(Math.abs(value)) / 3);
    const scaled = value / Math.pow(10, tier * 3);
    return `$${scaled.toFixed(tier > 0 ? 1 : 0)}${suffixes[tier]}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatNumber(value, decimals = 0) {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value, decimals = 2) {
  if (value == null || isNaN(value)) return '—';
  // value might be a ratio (0.0125) or already a percentage (1.25)
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(decimals)}%`;
}

export function formatROAS(value) {
  if (value == null || isNaN(value)) return '—';
  return `${Number(value).toFixed(2)}×`;
}

export function formatCompact(value) {
  if (value == null || isNaN(value)) return '—';
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(Math.round(value));
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateRange(start, end) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function daysAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDatePresetLabel(preset) {
  const labels = {
    last_7d: 'Last 7 Days',
    last_14d: 'Last 14 Days',
    last_30d: 'Last 30 Days',
    last_90d: 'Last 90 Days',
  };
  return labels[preset] || preset;
}

// ─── Safe Math ───────────────────────────────────────────────────────────────

export function safeDivide(numerator, denominator, defaultVal = null) {
  if (!denominator || denominator === 0 || numerator == null) return defaultVal;
  return numerator / denominator;
}

export function safePercent(part, whole) {
  return safeDivide(part, whole, 0) * 100;
}

export function percentChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ─── Campaign Classification ─────────────────────────────────────────────────

/**
 * Auto-classify a campaign by its name into a funnel category.
 * Supports common naming conventions: [ASC], [CBO], [ABO], RT-, Retargeting, Testing, etc.
 */
export function classifyCampaign(campaignName) {
  const name = (campaignName || '').toLowerCase();

  // ASC / Advantage+ 
  if (name.includes('[asc]') || name.includes('advantage+') || name.includes('asc ')) {
    return 'prospecting';
  }
  // Retargeting
  if (name.includes('retarget') || name.includes('[rt]') || name.includes('rt -') ||
      name.includes('remarketing') || name.includes('remarket')) {
    return 'retargeting';
  }
  // Testing
  if (name.includes('test') || name.includes('[test]') || name.includes('3-2-2') ||
      name.includes('creative test')) {
    return 'testing';
  }
  // CBO typically means prospecting / scaling
  if (name.includes('[cbo]') || name.includes('cbo ') || name.includes('prospecting') ||
      name.includes('broad') || name.includes('scaling')) {
    return 'prospecting';
  }
  // ABO could be testing or retargeting — default to prospecting
  if (name.includes('[abo]')) {
    if (name.includes('rt') || name.includes('retarget')) return 'retargeting';
    return 'testing';
  }
  return 'prospecting'; // default
}

/**
 * Get the campaign type label and color
 */
export function getCampaignTypeInfo(category) {
  const types = {
    prospecting: { label: 'Prospecting', color: '#0ea5e9', bgColor: '#0ea5e911' },
    retargeting: { label: 'Retargeting', color: '#f59e0b', bgColor: '#f59e0b11' },
    testing: { label: 'Testing', color: '#8b5cf6', bgColor: '#8b5cf611' },
  };
  return types[category] || types.prospecting;
}

// ─── Insights Normalization ──────────────────────────────────────────────────

/**
 * Normalize raw insights data from GoMarble into a clean, consistent format.
 */
export function normalizeInsights(raw) {
  if (!raw) return null;

  const spend = Number(raw.spend) || 0;
  const impressions = Number(raw.impressions) || 0;
  const clicks = Number(raw.clicks) || 0;
  const conversions = Number(raw.conversions) || 0;
  const revenue = Number(raw.revenue) || 0;
  const reach = Number(raw.reach) || 0;

  return {
    // Raw metrics
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    reach,
    frequency: Number(raw.frequency) || safeDivide(impressions, reach, 0),

    // Calculated efficiency metrics
    ctr: raw.ctr != null ? Number(raw.ctr) : safePercent(clicks, impressions),
    cpc: raw.cpc != null ? Number(raw.cpc) : safeDivide(spend, clicks),
    cpm: raw.cpm != null ? Number(raw.cpm) : safeDivide(spend * 1000, impressions),
    cpa: raw.cpa != null ? Number(raw.cpa)
      : raw.cost_per_action_type?.[0]?.value
        ? Number(raw.cost_per_action_type[0].value)
        : safeDivide(spend, conversions),
    roas: raw.purchase_roas != null ? Number(raw.purchase_roas)
      : raw.roas != null ? Number(raw.roas)
      : (revenue > 0 ? safeDivide(revenue, spend) : null),

    // Video metrics
    video3sViews: Number(raw.video_3_sec_watched_actions) || 0,
    video15sViews: Number(raw.video_15_sec_watched_actions) || 0,

    // Date range
    dateStart: raw.date_start,
    dateStop: raw.date_stop,

    // Daily breakdown for trends
    daily: (raw.daily || []).map(d => ({
      date: d.date,
      spend: Number(d.spend) || 0,
      conversions: Number(d.conversions) || 0,
      ctr: Number(d.ctr) || 0,
      cpm: Number(d.cpm) || 0,
      roas: d.purchase_roas != null ? Number(d.purchase_roas) : (d.roas != null ? Number(d.roas) : null),
      cpa: d.cpa != null ? Number(d.cpa) : null,
    })),
  };
}

// ─── Color Coding ────────────────────────────────────────────────────────────

export function getHealthColor(score) {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 50) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}

export function getHealthLabel(score) {
  if (score >= 80) return 'Healthy';
  if (score >= 50) return 'Caution';
  return 'Critical';
}

export function getVerdictColor(verdict) {
  const colors = {
    KILL: '#ef4444',
    SCALE: '#22c55e',
    ITERATE: '#f59e0b',
    'NEW CONCEPT': '#8b5cf6',
    MONITOR: '#64748b',
  };
  return colors[verdict] || '#64748b';
}

export function getVerdictBg(verdict) {
  const colors = {
    KILL: '#ef444418',
    SCALE: '#22c55e18',
    ITERATE: '#f59e0b18',
    'NEW CONCEPT': '#8b5cf618',
    MONITOR: '#64748b18',
  };
  return colors[verdict] || '#64748b18';
}

// ─── Trend Helpers ───────────────────────────────────────────────────────────

/**
 * Calculate the trend direction and percentage from daily data.
 * Compares recent period to prior period of same length.
 */
export function calculateTrend(dailyData, metric, recentDays = 3) {
  if (!dailyData || dailyData.length < recentDays * 2) return null;

  const recent = dailyData.slice(-recentDays);
  const prior = dailyData.slice(-recentDays * 2, -recentDays);

  const recentAvg = recent.reduce((s, d) => s + (d[metric] || 0), 0) / recentDays;
  const priorAvg = prior.reduce((s, d) => s + (d[metric] || 0), 0) / recentDays;

  const change = percentChange(recentAvg, priorAvg);
  return {
    direction: change > 2 ? 'up' : change < -2 ? 'down' : 'flat',
    change: change != null ? Math.round(change * 10) / 10 : null,
    recentAvg,
    priorAvg,
  };
}

export function getTrendIcon(direction) {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  return '→';
}

/**
 * For metrics where DOWN is good (CPA, CPM), flip the color logic
 */
export function getTrendColor(direction, lowerIsBetter = false) {
  if (direction === 'flat') return '#94a3b8';
  if (lowerIsBetter) {
    return direction === 'down' ? '#22c55e' : '#ef4444';
  }
  return direction === 'up' ? '#22c55e' : '#ef4444';
}
