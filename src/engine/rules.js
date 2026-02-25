/**
 * Decision Engine — Kill / Scale / Iterate / New Concept Rules
 * 
 * Each rule function returns a verdict object:
 * { 
 *   signal: 'KILL' | 'SCALE' | 'ITERATE' | 'NEW CONCEPT' | 'MONITOR',
 *   priority: 0-3 (P0=highest),
 *   urgency: 'RED' | 'YELLOW' | 'GREEN',
 *   reason: string,
 *   metric: string,
 *   currentValue: number,
 *   threshold: number,
 *   action: string,
 *   expectedImpact: string,
 * }
 */

import { percentChange } from '../utils/normalize.js';
import { hookRate, holdRate, learningPhaseScore } from '../utils/metrics.js';

// ─── KILL Rules (P0 — Revenue at Risk) ──────────────────────────────────────

export function checkKillSignals(entity, thresholds) {
  const signals = [];
  const t = thresholds.kill;
  const profile = thresholds.profile;

  // KILL-1: Spend ≥ 3× target CPA with 0 conversions → immediate pause
  if (entity.spend >= profile.targetCPA * t.spendMultiplierZeroConversions && entity.conversions === 0) {
    signals.push({
      signal: 'KILL',
      priority: 0,
      urgency: 'RED',
      reason: `Spent ${formatDollar(entity.spend)} (${(entity.spend / profile.targetCPA).toFixed(1)}× target CPA) with zero conversions`,
      metric: 'spend_vs_cpa',
      currentValue: entity.spend,
      threshold: profile.targetCPA * t.spendMultiplierZeroConversions,
      action: 'Pause immediately. Reallocate budget to performing ad sets.',
      expectedImpact: `Save ~${formatDollar(entity.spend / 7)}/day in wasted spend`,
    });
  }

  // KILL-2: CPA 20-30% worse than target after 3+ days
  if (entity.cpa != null && profile.targetCPA > 0 && entity.daysRunning >= t.cpaWorseDaysRequired) {
    const cpaOverage = (entity.cpa - profile.targetCPA) / profile.targetCPA;
    if (cpaOverage >= t.cpaWorsePercent) {
      signals.push({
        signal: 'KILL',
        priority: 0,
        urgency: cpaOverage >= 0.30 ? 'RED' : 'YELLOW',
        reason: `CPA at ${formatDollar(entity.cpa)} is ${(cpaOverage * 100).toFixed(0)}% above target (${formatDollar(profile.targetCPA)}) for ${entity.daysRunning}+ days`,
        metric: 'cpa_vs_target',
        currentValue: entity.cpa,
        threshold: profile.targetCPA * (1 + t.cpaWorsePercent),
        action: 'Pause ad set. Test new creative or broaden audience.',
        expectedImpact: `Recover ~${formatDollar((entity.cpa - profile.targetCPA) * (entity.conversions || 1))} in overspend`,
      });
    }
  }

  // KILL-3: Frequency > 3.0 AND CTR declining WoW
  if (entity.frequency > t.frequencyKillThreshold && entity.ctrTrend === 'declining') {
    signals.push({
      signal: 'KILL',
      priority: 0,
      urgency: entity.frequency >= 4.0 ? 'RED' : 'YELLOW',
      reason: `Frequency at ${entity.frequency.toFixed(1)} (threshold: ${t.frequencyKillThreshold}) with CTR declining week-over-week`,
      metric: 'frequency_fatigue',
      currentValue: entity.frequency,
      threshold: t.frequencyKillThreshold,
      action: 'Creative fatigue detected. Pause and launch fresh creative under new ad IDs.',
      expectedImpact: 'Prevent further CPA degradation from audience over-saturation',
    });
  }

  // KILL-4: ROAS below break-even for 3+ consecutive days
  if (entity.roasBelowBreakevenDays >= t.roasBelowBreakevenDays && entity.roas != null) {
    signals.push({
      signal: 'KILL',
      priority: 0,
      urgency: 'RED',
      reason: `ROAS below break-even (${profile.breakEvenROAS}×) for ${entity.roasBelowBreakevenDays} consecutive days`,
      metric: 'roas_breakeven',
      currentValue: entity.roas,
      threshold: profile.breakEvenROAS,
      action: 'Pause and reallocate. Campaign is losing money daily.',
      expectedImpact: `Stop bleeding ~${formatDollar(entity.spend / 7 * (1 - (entity.roas || 0) / profile.breakEvenROAS))}/day`,
    });
  }

  return signals;
}

// ─── SCALE Rules (P1 — Revenue Opportunity) ──────────────────────────────────

export function checkScaleSignals(entity, thresholds) {
  const signals = [];
  const t = thresholds.scale;
  const profile = thresholds.profile;

  // SCALE-1: Stable CPA/ROAS for 7-14 days
  const isStable = entity.daysStable >= t.stabilityDaysRequired;
  const isLeadGen = profile.businessType === 'leadgen';

  // For lead gen: scale if CPA is at/below target; for ecommerce: scale if ROAS at/above target
  if (isStable && isLeadGen && entity.cpa != null && entity.cpa <= profile.targetCPA) {
    const newBudget = (entity.dailyBudget || entity.spend / 7) * (1 + t.maxBudgetIncreasePercent);
    signals.push({
      signal: 'SCALE',
      priority: 1,
      urgency: 'GREEN',
      reason: `Stable performance for ${entity.daysStable} days with CPA at ${formatDollar(entity.cpa)} (target: ${formatDollar(profile.targetCPA)})`,
      metric: 'stability_cpa',
      currentValue: entity.daysStable,
      threshold: t.stabilityDaysRequired,
      action: `Increase daily budget from ${formatDollar(entity.dailyBudget)} → ${formatDollar(newBudget)} (+20%)`,
      expectedImpact: `~${Math.round((newBudget - (entity.dailyBudget || 0)) / (entity.cpa || 1))} additional daily conversions`,
    });
  }

  if (isStable && entity.roas != null && profile.targetROAS > 0 && entity.roas >= profile.targetROAS) {
    const newBudget = (entity.dailyBudget || entity.spend / 7) * (1 + t.maxBudgetIncreasePercent);
    signals.push({
      signal: 'SCALE',
      priority: 1,
      urgency: 'GREEN',
      reason: `Stable performance for ${entity.daysStable} days with ${entity.roas?.toFixed(2)}× ROAS (target: ${profile.targetROAS}×)`,
      metric: 'stability',
      currentValue: entity.daysStable,
      threshold: t.stabilityDaysRequired,
      action: `Increase daily budget from ${formatDollar(entity.dailyBudget)} → ${formatDollar(newBudget)} (+20%)`,
      expectedImpact: `~${Math.round((newBudget - (entity.dailyBudget || 0)) * entity.roas)} additional daily revenue at current ROAS`,
    });
  }

  // SCALE-2: Exited learning phase (50+ conversions/week)
  const lpScore = learningPhaseScore(entity.conversionsLast7d);
  if (lpScore >= 1.0 && entity.roas >= profile.targetROAS) {
    signals.push({
      signal: 'SCALE',
      priority: 1,
      urgency: 'GREEN',
      reason: `Exited learning phase with ${entity.conversionsLast7d} conversions/week (50 needed)`,
      metric: 'learning_phase',
      currentValue: entity.conversionsLast7d,
      threshold: t.learningPhaseConversionsWeekly,
      action: 'Scale eligible. Apply 20% budget increase every 48-72 hours.',
      expectedImpact: 'Mature ad set with stable delivery — scale with confidence',
    });
  }

  // SCALE-3: Frequency headroom + high conversion volume
  if (entity.frequency < t.frequencyScaleMax && entity.dailyConversions >= t.minDailyConversions) {
    signals.push({
      signal: 'SCALE',
      priority: 1,
      urgency: 'GREEN',
      reason: `Frequency at ${entity.frequency?.toFixed(1)} (headroom to ${t.frequencyScaleMax}) with ${entity.dailyConversions} conv/day`,
      metric: 'frequency_headroom',
      currentValue: entity.frequency,
      threshold: t.frequencyScaleMax,
      action: 'Audience headroom exists. Safe to scale budget vertically.',
      expectedImpact: `Room to grow before fatigue (~${((t.frequencyScaleMax - entity.frequency) / 0.1 * 3).toFixed(0)} more days at current velocity)`,
    });
  }

  return signals;
}

// ─── ITERATE Rules (P2 — Efficiency Gains) ───────────────────────────────────

export function checkIterateSignals(entity, thresholds) {
  const signals = [];
  const t = thresholds.iterate;

  // ITERATE-1: CTR declining 15-20% WoW but concept still works
  if (entity.ctrChangeWoW != null) {
    const decline = -entity.ctrChangeWoW / 100; // convert to positive fraction
    if (decline >= t.ctrDeclineWoWPercent && decline < t.ctrDeclineWoWCritical) {
      signals.push({
        signal: 'ITERATE',
        priority: 2,
        urgency: 'YELLOW',
        reason: `CTR declining ${(decline * 100).toFixed(0)}% week-over-week (threshold: ${(t.ctrDeclineWoWPercent * 100).toFixed(0)}%)`,
        metric: 'ctr_decline',
        currentValue: entity.ctrChangeWoW,
        threshold: -(t.ctrDeclineWoWPercent * 100),
        action: 'Test new hooks and headlines while preserving the winning concept.',
        expectedImpact: 'Extend creative lifespan by 1-2 weeks with fresh angles',
      });
    }
  }

  // ITERATE-2: Hook rate dropping below threshold
  if (entity.hookRate != null && entity.hookRate < t.hookRateIterateThreshold) {
    signals.push({
      signal: 'ITERATE',
      priority: 2,
      urgency: 'YELLOW',
      reason: `Hook rate at ${(entity.hookRate * 100).toFixed(1)}% — below ${(t.hookRateIterateThreshold * 100).toFixed(0)}% threshold`,
      metric: 'hook_rate',
      currentValue: entity.hookRate,
      threshold: t.hookRateIterateThreshold,
      action: 'Opening 3 seconds need work. Test new video hooks with the same body content.',
      expectedImpact: 'A strong hook (>30%) can boost CTR by 40-60%',
    });
  }

  return signals;
}

// ─── NEW CONCEPT Rules (P3 — Pipeline Health) ────────────────────────────────

export function checkNewConceptSignals(entity, thresholds) {
  const signals = [];
  const t = thresholds.newConcept;

  // NEW CONCEPT-1: All creatives fatigued in ad set
  if (entity.allCreativesFatigued) {
    signals.push({
      signal: 'NEW CONCEPT',
      priority: 3,
      urgency: 'YELLOW',
      reason: 'All creative variations in this ad set show fatigue signals',
      metric: 'creative_exhaustion',
      currentValue: entity.fatiguedCreativeCount,
      threshold: entity.totalCreativeCount,
      action: 'Generate new creative brief. Test fundamentally different concepts, formats, and messaging angles.',
      expectedImpact: 'Fresh concepts typically see 30-50% better CTR than fatigued ones',
    });
  }

  // NEW CONCEPT-2: Audience saturated (frequency > 3.0 + declining reach)
  if (entity.frequency > t.audienceSaturatedFrequency && entity.reachTrend === 'declining') {
    signals.push({
      signal: 'NEW CONCEPT',
      priority: 3,
      urgency: 'YELLOW',
      reason: `Audience saturated — frequency at ${entity.frequency?.toFixed(1)} with declining reach`,
      metric: 'audience_saturation',
      currentValue: entity.frequency,
      threshold: t.audienceSaturatedFrequency,
      action: 'New creative angles needed to reach untapped audience segments. Consider new formats (Reels, UGC).',
      expectedImpact: 'Diverse creative unlocks new audience clusters within broad targeting',
    });
  }

  return signals;
}

// ─── Master Evaluator ────────────────────────────────────────────────────────

/**
 * Run all rule checks against an entity (campaign, ad set, or ad)
 * and return the highest-priority verdict plus all signals.
 */
export function evaluateEntity(entity, thresholds) {
  const allSignals = [
    ...checkKillSignals(entity, thresholds),
    ...checkScaleSignals(entity, thresholds),
    ...checkIterateSignals(entity, thresholds),
    ...checkNewConceptSignals(entity, thresholds),
  ];

  // Sort by priority (P0 first), then urgency
  allSignals.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const urgencyOrder = { RED: 0, YELLOW: 1, GREEN: 2 };
    return (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2);
  });

  const verdict = allSignals.length > 0 ? allSignals[0].signal : 'MONITOR';

  return {
    verdict,
    topSignal: allSignals[0] || null,
    signals: allSignals,
    signalCount: allSignals.length,
  };
}

/**
 * Prepare entity data with derived fields needed by the rules engine.
 * Enriches raw normalized data with trend calculations, learning phase status, etc.
 */
export function prepareEntityForEvaluation(entity, insights, dailyData = [], thresholds = {}) {
  const profile = thresholds.profile || {};

  // Calculate derived fields
  const conversionsLast7d = dailyData.slice(-7).reduce((s, d) => s + (d.conversions || 0), 0);
  const dailyConversions = dailyData.length > 0
    ? dailyData.slice(-3).reduce((s, d) => s + (d.conversions || 0), 0) / Math.min(3, dailyData.length)
    : insights?.conversions ? insights.conversions / 7 : 0;

  // CTR trend WoW
  let ctrChangeWoW = null;
  if (dailyData.length >= 14) {
    const thisWeek = dailyData.slice(-7).reduce((s, d) => s + (d.ctr || 0), 0) / 7;
    const lastWeek = dailyData.slice(-14, -7).reduce((s, d) => s + (d.ctr || 0), 0) / 7;
    ctrChangeWoW = percentChange(thisWeek, lastWeek);
  }
  const ctrTrend = ctrChangeWoW != null && ctrChangeWoW < -10 ? 'declining' : 'stable';

  // ROAS below break-even streak
  let roasBelowBreakevenDays = 0;
  if (dailyData.length > 0) {
    for (let i = dailyData.length - 1; i >= 0; i--) {
      if ((dailyData[i].roas || 0) < (profile.breakEvenROAS || 2.0)) {
        roasBelowBreakevenDays++;
      } else break;
    }
  }

  // Stability check
  let daysStable = 0;
  if (dailyData.length >= 7 && insights?.cpa != null) {
    const targetCPA = profile.targetCPA || 30;
    for (let i = dailyData.length - 1; i >= 0; i--) {
      const dayCpa = dailyData[i].cpa;
      if (dayCpa != null && Math.abs(dayCpa - targetCPA) / targetCPA < 0.25) {
        daysStable++;
      } else break;
    }
  }

  // Days running
  const daysRunning = dailyData.length || 7;

  // Hook and hold rates
  const hr = insights?.video3sViews ? hookRate(insights.video3sViews, insights.impressions) : null;
  const hlr = insights?.video15sViews && insights?.video3sViews
    ? holdRate(insights.video15sViews, insights.video3sViews) : null;

  return {
    // Identity
    id: entity.id,
    name: entity.name,
    status: entity.status,
    type: entity.type || 'unknown',

    // Core metrics from insights
    spend: insights?.spend || 0,
    impressions: insights?.impressions || 0,
    clicks: insights?.clicks || 0,
    conversions: insights?.conversions || 0,
    revenue: insights?.revenue || 0,
    ctr: insights?.ctr || 0,
    cpc: insights?.cpc || null,
    cpm: insights?.cpm || null,
    cpa: insights?.cpa || null,
    roas: insights?.roas || null,
    frequency: insights?.frequency || 0,
    reach: insights?.reach || 0,

    // Derived / enriched
    hookRate: hr,
    holdRate: hlr,
    conversionsLast7d,
    dailyConversions: Math.round(dailyConversions * 10) / 10,
    ctrChangeWoW,
    ctrTrend,
    roasBelowBreakevenDays,
    daysStable,
    daysRunning,
    dailyBudget: Number(entity.daily_budget || entity.dailyBudget) || null,

    // Creative fatigue indicators
    allCreativesFatigued: false, // set by creative analysis
    fatiguedCreativeCount: 0,
    totalCreativeCount: 0,
    reachTrend: 'stable', // TODO: calculate from daily reach data
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDollar(val) {
  if (val == null) return '$0';
  return `$${Number(val).toFixed(0)}`;
}
