/**
 * Default thresholds for the Meta Ads Optimization Engine.
 * All values are configurable per client profile via Settings tab.
 * Source: 2024-2025 Meta Ads Playbook
 */
const DEFAULT_THRESHOLDS = {
  // === CLIENT PROFILE DEFAULTS ===
  profile: {
    businessType: 'ecommerce', // 'ecommerce' | 'leadgen'
    targetCPA: 30,
    targetROAS: 3.0,
    breakEvenROAS: 2.0,
    monthlyBudget: 25000,
    currency: 'USD',
    // Lead gen specific: which action_type counts as a conversion
    leadGenConversionEvent: 'landing_page_view', // 'landing_page_view' | 'link_click' | 'lead'
  },

  // === KILL SIGNALS ===
  kill: {
    // Spend ≥ N× target CPA with 0 conversions → immediate pause
    spendMultiplierZeroConversions: 3,
    // CPA N% worse than target after 3+ days → pause & reallocate
    cpaWorsePercent: 0.25, // 25%
    cpaWorseDaysRequired: 3,
    // Frequency threshold + CTR declining WoW → creative fatigue kill
    frequencyKillThreshold: 3.0,
    // ROAS below break-even for N+ consecutive days
    roasBelowBreakevenDays: 3,
  },

  // === SCALE SIGNALS ===
  scale: {
    // Stable CPA/ROAS for N days → eligible for budget increase
    stabilityDaysRequired: 7,
    stabilityDaysIdeal: 14,
    // Budget increase max per change (20% rule)
    maxBudgetIncreasePercent: 0.20,
    // Budget increase frequency (hours between changes)
    budgetChangeIntervalHours: 48,
    // Min conversions per week to exit learning phase
    learningPhaseConversionsWeekly: 50,
    // Frequency headroom threshold
    frequencyScaleMax: 2.5,
    // Min conversions per day for scale readiness
    minDailyConversions: 8,
    idealDailyConversions: 10,
    // ROAS multiplier above target for scale
    roasScaleMultiplier: 2.0,
  },

  // === ITERATE SIGNALS ===
  iterate: {
    // CTR decline WoW that triggers iterate
    ctrDeclineWoWPercent: 0.15, // 15%
    ctrDeclineWoWCritical: 0.20, // 20%
    // Hook rate dropping below threshold
    hookRateIterateThreshold: 0.25, // 25%
  },

  // === NEW CONCEPT SIGNALS ===
  newConcept: {
    // All creatives frequency above this = audience saturated
    audienceSaturatedFrequency: 3.0,
    // CVR decline threshold despite fresh hooks
    cvrDeclinePercent: 0.15, // 15%
  },

  // === CREATIVE HEALTH SCORING ===
  creativeHealth: {
    // Hook Rate: 3-second views / impressions
    hookRate: {
      weight: 0.25,
      excellent: 0.35, // 35%+
      good: 0.30,      // 30%+
      concern: 0.25,   // below 25%
    },
    // Hold Rate: 15-second views / 3-second views
    holdRate: {
      weight: 0.20,
      excellent: 0.50,
      good: 0.40,
      concern: 0.30,
    },
    // CTR vs benchmark
    ctr: {
      weight: 0.25,
      excellent: 0.02,  // 2%+
      good: 0.0090,     // 0.90%
      benchmarkCold: 0.0090, // cold traffic baseline
      benchmarkWarm: 0.016,  // warm traffic
    },
    // Frequency impact (inverse — lower is better)
    frequency: {
      weight: 0.15,
      excellent: 1.5,  // below 1.5
      good: 2.0,       // below 2.0
      concern: 2.5,    // 2.5+
      critical: 3.0,   // 3.0+
    },
    // CPA efficiency vs ad set average
    cpaEfficiency: {
      weight: 0.15,
      excellent: 0.80, // 20% better than avg
      good: 1.0,       // at avg
      concern: 1.20,   // 20% worse
      critical: 1.30,  // 30% worse
    },
    // Score color bands
    colorBands: {
      green: 80,  // 80-100
      yellow: 50, // 50-79
      red: 0,     // 0-49
    },
  },

  // === BUDGET ALLOCATION ===
  budget: {
    // Target allocation percentages (should sum to 1.0)
    targetAllocation: {
      prospecting: 0.70,
      retargeting: 0.20,
      testing: 0.10,
    },
    // Deviation threshold to flag (percentage points)
    deviationAlertThreshold: 0.10, // 10pp
    // Minimum daily budget formula: (Target CPA × 50) ÷ 7
    learningPhaseMultiplier: 50,
    learningPhaseDivisor: 7,
    // Budget utilization thresholds
    utilizationGood: 0.85,    // 85%+
    utilizationConcern: 0.70, // below 70%
  },

  // === FATIGUE DETECTION ===
  fatigue: {
    // Creative typical lifespan in days
    typicalLifespanDays: 21, // 2-4 weeks, using midpoint
    refreshWarningDays: 14,
    // Frequency when purchase intent drops ~16%
    frequencyPurchaseIntentDrop: 6,
    // CPM rise WoW threshold
    cpmRiseWoWPercent: 0.30, // 30%
    // Meta's built-in fatigue: cost per result hits 2× historical avg
    costPerResultFatigueMultiplier: 2.0,
  },

  // === TESTING ===
  testing: {
    // Minimum spend per creative before judgment: 3× AOV
    minSpendMultiplierAOV: 3,
    // Minimum impressions before judgment
    minImpressions: 10000,
    // Minimum run time (days)
    minRunDays: 4,
    // Testing volume: ads per $50K monthly spend
    adsPerFiftyK: 12.5, // midpoint of 10-15
    // Creative testing budget percentage
    testingBudgetPercent: 0.25, // 25%
    // Creative refresh interval (days)
    refreshIntervalDays: 17.5, // midpoint of 2-3 weeks
  },

  // === INDUSTRY BENCHMARKS (2025) ===
  benchmarks: {
    averageROAS: { low: 2.19, high: 2.98, good: 3.0, excellent: 5.0 },
    averageCPA: 18.68,
    averageCTR: { low: 0.0090, high: 0.0149 },
    averageCPM: { low: 10, high: 18, us: 20.48 },
    // Q4 adjustments
    q4: {
      cpmSurgePercent: 0.45, // midpoint of 25-66%
      conversionRateJump: 0.32, // ~32%
      roasIncrease: 0.12, // ~12%
    },
  },

  // === ATTRIBUTION ===
  attribution: {
    // Default window
    defaultWindow: '7d_click_1d_view',
    // View-through conversion threshold to switch to click-only
    viewThroughSwitchThreshold: 0.25, // 25%
    // CAPI Event Match Quality target
    capiEMQTarget: 6.0,
    // Typical incrementality factor
    incrementalityFactor: 0.65, // 60-70%, using midpoint
  },
};

export default DEFAULT_THRESHOLDS;
