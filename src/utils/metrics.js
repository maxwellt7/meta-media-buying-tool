/**
 * Derived Metric Functions
 * Calculates KPIs not directly available from GoMarble API.
 * All thresholds reference config/thresholds.js
 */

import { safeDivide, percentChange } from './normalize.js';

// ─── Core Derived Metrics ────────────────────────────────────────────────────

/**
 * Hook Rate: % of impressions that result in 3-second video views
 * Target: > 30%, Concern: < 25%
 */
export function hookRate(video3sViews, impressions) {
  return safeDivide(video3sViews, impressions, 0);
}

/**
 * Hold Rate: % of 3-second viewers who watch to 15 seconds
 * Target: > 40%, Concern: < 30%
 */
export function holdRate(video15sViews, video3sViews) {
  return safeDivide(video15sViews, video3sViews, 0);
}

/**
 * CPA Velocity: Rate of CPA change relative to rolling average
 * Positive = CPA rising (bad), Negative = CPA falling (good)
 */
export function cpaVelocity(currentCPA, rollingAvgCPA) {
  if (!rollingAvgCPA || rollingAvgCPA === 0) return 0;
  return (currentCPA - rollingAvgCPA) / rollingAvgCPA;
}

/**
 * Frequency Velocity: Daily change in frequency
 * Concern: > 0.1/day, Critical: > 0.3/day
 */
export function frequencyVelocity(dailyData) {
  if (!dailyData || dailyData.length < 2) return 0;
  const recent = dailyData.slice(-2);
  return (recent[1]?.frequency || 0) - (recent[0]?.frequency || 0);
}

/**
 * ROAS Trend: Ratio of 3-day rolling to 7-day rolling
 * Target: > 0.95 (stable/improving), Concern: < 0.80 (declining)
 */
export function roasTrend(dailyData) {
  if (!dailyData || dailyData.length < 7) return null;

  const last3 = dailyData.slice(-3);
  const last7 = dailyData.slice(-7);

  const avg3 = last3.reduce((s, d) => s + (d.roas || 0), 0) / 3;
  const avg7 = last7.reduce((s, d) => s + (d.roas || 0), 0) / 7;

  return safeDivide(avg3, avg7, null);
}

/**
 * Learning Phase Score: How close an ad set is to exiting learning phase
 * Score = conversions_last_7d / 50. Score >= 1.0 = exited learning
 */
export function learningPhaseScore(conversionsLast7d) {
  return safeDivide(conversionsLast7d, 50, 0);
}

/**
 * Budget Utilization: Actual spend as % of daily budget
 * Target: 85-100%, Concern: < 70%
 */
export function budgetUtilization(actualSpend, dailyBudget) {
  return safeDivide(actualSpend, dailyBudget, 0);
}

/**
 * Minimum daily budget needed to exit learning phase
 * Formula: (Target CPA × 50) ÷ 7
 */
export function minDailyBudget(targetCPA) {
  return (targetCPA * 50) / 7;
}

// ─── Creative Health Score ───────────────────────────────────────────────────

/**
 * Calculate a 0-100 health score for an ad creative.
 * Weights: Hook Rate 25%, Hold Rate 20%, CTR 25%, Frequency 15%, CPA Efficiency 15%
 */
export function creativeHealthScore(metrics, thresholds) {
  const th = thresholds.creativeHealth;
  let score = 0;

  // Hook Rate component (25%)
  if (metrics.hookRate != null) {
    const hr = metrics.hookRate;
    if (hr >= th.hookRate.excellent) score += 100 * th.hookRate.weight;
    else if (hr >= th.hookRate.good) score += 80 * th.hookRate.weight;
    else if (hr >= th.hookRate.concern) score += 50 * th.hookRate.weight;
    else score += 20 * th.hookRate.weight;
  } else {
    // No video data — redistribute weight to CTR
    score += (metrics.ctrScore || 50) * th.hookRate.weight;
  }

  // Hold Rate component (20%)
  if (metrics.holdRate != null) {
    const hlr = metrics.holdRate;
    if (hlr >= th.holdRate.excellent) score += 100 * th.holdRate.weight;
    else if (hlr >= th.holdRate.good) score += 80 * th.holdRate.weight;
    else if (hlr >= th.holdRate.concern) score += 50 * th.holdRate.weight;
    else score += 20 * th.holdRate.weight;
  } else {
    score += (metrics.ctrScore || 50) * th.holdRate.weight;
  }

  // CTR component (25%)
  const ctr = metrics.ctr || 0;
  const ctrAsDecimal = ctr > 1 ? ctr / 100 : ctr; // handle both 1.5 and 0.015
  if (ctrAsDecimal >= th.ctr.excellent) score += 100 * th.ctr.weight;
  else if (ctrAsDecimal >= th.ctr.good) score += 80 * th.ctr.weight;
  else if (ctrAsDecimal >= th.ctr.good * 0.7) score += 50 * th.ctr.weight;
  else score += 20 * th.ctr.weight;

  // Frequency component (15%) — inverse: lower is better
  const freq = metrics.frequency || 0;
  if (freq <= th.frequency.excellent) score += 100 * th.frequency.weight;
  else if (freq <= th.frequency.good) score += 80 * th.frequency.weight;
  else if (freq <= th.frequency.concern) score += 50 * th.frequency.weight;
  else score += 15 * th.frequency.weight;

  // CPA Efficiency component (15%) — ratio to ad set average
  const cpaEff = metrics.cpaEfficiency || 1.0;
  if (cpaEff <= th.cpaEfficiency.excellent) score += 100 * th.cpaEfficiency.weight;
  else if (cpaEff <= th.cpaEfficiency.good) score += 80 * th.cpaEfficiency.weight;
  else if (cpaEff <= th.cpaEfficiency.concern) score += 50 * th.cpaEfficiency.weight;
  else score += 15 * th.cpaEfficiency.weight;

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ─── Account Health Score ────────────────────────────────────────────────────

/**
 * Calculate an overall 0-100 account health score.
 * Components: ROAS vs target, CPA efficiency, learning phase coverage,
 *             creative fatigue level, budget utilization
 */
export function accountHealthScore(accountData, thresholds) {
  const { profile } = thresholds;
  let score = 0;
  let totalWeight = 0;

  // 1. ROAS vs target (weight: 30)
  if (accountData.roas != null) {
    const roasRatio = accountData.roas / profile.targetROAS;
    const roasScore = Math.min(100, roasRatio * 80);
    score += roasScore * 0.30;
    totalWeight += 0.30;
  }

  // 2. CPA efficiency (weight: 25)
  if (accountData.cpa != null && profile.targetCPA > 0) {
    const cpaRatio = profile.targetCPA / accountData.cpa; // inverse: lower CPA is better
    const cpaScore = Math.min(100, cpaRatio * 80);
    score += cpaScore * 0.25;
    totalWeight += 0.25;
  }

  // 3. Learning phase coverage (weight: 20)
  if (accountData.adSetsExitedLearning != null && accountData.totalAdSets > 0) {
    const lpScore = (accountData.adSetsExitedLearning / accountData.totalAdSets) * 100;
    score += lpScore * 0.20;
    totalWeight += 0.20;
  }

  // 4. Creative health average (weight: 15)
  if (accountData.avgCreativeHealth != null) {
    score += accountData.avgCreativeHealth * 0.15;
    totalWeight += 0.15;
  }

  // 5. Budget utilization (weight: 10)
  if (accountData.budgetUtilization != null) {
    const buScore = Math.min(100, accountData.budgetUtilization * 100);
    score += buScore * 0.10;
    totalWeight += 0.10;
  }

  // Normalize if some components missing
  if (totalWeight > 0 && totalWeight < 1) {
    score = score / totalWeight;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ─── Rolling Averages ────────────────────────────────────────────────────────

export function rollingAverage(dailyData, metric, days) {
  if (!dailyData || dailyData.length === 0) return null;
  const slice = dailyData.slice(-days);
  const validValues = slice.filter(d => d[metric] != null).map(d => d[metric]);
  if (validValues.length === 0) return null;
  return validValues.reduce((s, v) => s + v, 0) / validValues.length;
}

export function weekOverWeekChange(dailyData, metric) {
  if (!dailyData || dailyData.length < 14) return null;
  const thisWeek = dailyData.slice(-7);
  const lastWeek = dailyData.slice(-14, -7);

  const thisAvg = thisWeek.reduce((s, d) => s + (d[metric] || 0), 0) / 7;
  const lastAvg = lastWeek.reduce((s, d) => s + (d[metric] || 0), 0) / 7;

  return percentChange(thisAvg, lastAvg);
}

// ─── Budget Analysis ─────────────────────────────────────────────────────────

/**
 * Analyze budget allocation across funnel stages
 * Returns deviation from 70/20/10 target
 */
export function analyzeBudgetAllocation(campaigns, thresholds) {
  const target = thresholds.budget.targetAllocation;
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0);

  if (totalSpend === 0) return null;

  const actual = { prospecting: 0, retargeting: 0, testing: 0 };
  campaigns.forEach(c => {
    actual[c.funnelCategory || 'prospecting'] += c.spend || 0;
  });

  const actualPct = {
    prospecting: actual.prospecting / totalSpend,
    retargeting: actual.retargeting / totalSpend,
    testing: actual.testing / totalSpend,
  };

  const deviations = {
    prospecting: actualPct.prospecting - target.prospecting,
    retargeting: actualPct.retargeting - target.retargeting,
    testing: actualPct.testing - target.testing,
  };

  const hasAlert = Object.values(deviations).some(
    d => Math.abs(d) > thresholds.budget.deviationAlertThreshold
  );

  return {
    actual,
    actualPct,
    target,
    deviations,
    hasAlert,
    totalSpend,
  };
}
