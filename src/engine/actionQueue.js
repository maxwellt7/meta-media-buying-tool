/**
 * Priority Action Queue Generator
 * 
 * Collects all signals across all entities, deduplicates, and ranks them
 * into a priority-ordered action queue for the Command Center.
 * 
 * Priority Hierarchy:
 *   P0 — KILL (Revenue at Risk)
 *   P1 — SCALE (Revenue Opportunity)
 *   P2 — ITERATE (Efficiency Gains)
 *   P3 — NEW CONCEPT (Pipeline Health)
 */

import { evaluateEntity, prepareEntityForEvaluation } from './rules.js';
import { normalizeInsights, classifyCampaign } from '../utils/normalize.js';
import { creativeHealthScore, accountHealthScore, analyzeBudgetAllocation } from '../utils/metrics.js';

/**
 * Process full account data through the decision engine.
 * Returns action queue, verdicts, health scores, and budget analysis.
 */
export function processAccountData(accountData, thresholds) {
  const actions = [];
  const campaignVerdicts = [];
  const adSetVerdicts = [];
  const adVerdicts = [];
  let totalCreativeHealthScore = 0;
  let creativeCount = 0;
  let adSetsExitedLearning = 0;
  let totalAdSets = 0;

  const campaigns = accountData.campaigns || [];

  campaigns.forEach(campaign => {
    const campaignInsights = normalizeInsights(campaign.insights);
    const funnelCategory = classifyCampaign(campaign.name);

    const campaignEntity = prepareEntityForEvaluation(
      { ...campaign, type: 'campaign' },
      campaignInsights,
      campaignInsights?.daily || [],
      thresholds
    );
    campaignEntity.funnelCategory = funnelCategory;

    const campaignEval = evaluateEntity(campaignEntity, thresholds);
    campaignVerdicts.push({
      ...campaignEntity,
      ...campaignEval,
      funnelCategory,
    });

    // Add campaign-level signals to action queue
    campaignEval.signals.forEach(signal => {
      actions.push({
        ...signal,
        entityType: 'campaign',
        entityId: campaign.id,
        entityName: campaign.name,
        funnelCategory,
      });
    });

    // Process ad sets
    (campaign.adSets || []).forEach(adSet => {
      totalAdSets++;
      const adSetInsights = normalizeInsights(adSet.insights);
      const adSetEntity = prepareEntityForEvaluation(
        { ...adSet, type: 'adset' },
        adSetInsights,
        adSetInsights?.daily || [],
        thresholds
      );

      // Check learning phase
      if (adSetEntity.conversionsLast7d >= 50) {
        adSetsExitedLearning++;
      }

      const adSetEval = evaluateEntity(adSetEntity, thresholds);
      adSetVerdicts.push({
        ...adSetEntity,
        ...adSetEval,
        campaignId: campaign.id,
        campaignName: campaign.name,
        funnelCategory,
      });

      adSetEval.signals.forEach(signal => {
        actions.push({
          ...signal,
          entityType: 'adset',
          entityId: adSet.id,
          entityName: adSet.name,
          campaignName: campaign.name,
          funnelCategory,
        });
      });

      // Process ads
      (adSet.ads || []).forEach(ad => {
        const adInsights = normalizeInsights(ad.insights);
        if (!adInsights) return;

        // Calculate creative health
        const adSetAvgCpa = adSetInsights?.cpa || thresholds.profile.targetCPA;
        const healthMetrics = {
          hookRate: adInsights.video3sViews > 0
            ? adInsights.video3sViews / (adInsights.impressions || 1)
            : null,
          holdRate: adInsights.video3sViews > 0
            ? adInsights.video15sViews / adInsights.video3sViews
            : null,
          ctr: adInsights.ctr,
          frequency: adInsights.frequency,
          cpaEfficiency: adInsights.cpa ? adInsights.cpa / adSetAvgCpa : 1.0,
        };

        const healthScore = creativeHealthScore(healthMetrics, thresholds);
        totalCreativeHealthScore += healthScore;
        creativeCount++;

        const adEntity = prepareEntityForEvaluation(
          { ...ad, type: 'ad' },
          adInsights,
          adInsights?.daily || [],
          thresholds
        );

        const adEval = evaluateEntity(adEntity, thresholds);
        adVerdicts.push({
          ...adEntity,
          ...adEval,
          healthScore,
          healthMetrics,
          adSetId: adSet.id,
          adSetName: adSet.name,
          campaignId: campaign.id,
          campaignName: campaign.name,
          funnelCategory,
        });

        adEval.signals.forEach(signal => {
          actions.push({
            ...signal,
            entityType: 'ad',
            entityId: ad.id,
            entityName: ad.name,
            adSetName: adSet.name,
            campaignName: campaign.name,
            healthScore,
          });
        });
      });
    });
  });

  // Sort action queue by priority, then urgency
  actions.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const urgencyOrder = { RED: 0, YELLOW: 1, GREEN: 2 };
    return (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2);
  });

  // Account-level metrics for health score
  const accountInsights = normalizeInsights(accountData.account?.insights);
  const avgCreativeHealth = creativeCount > 0 ? totalCreativeHealthScore / creativeCount : null;
  const totalSpend = accountInsights?.spend || 0;
  const totalBudget = campaigns.reduce((s, c) => s + (Number(c.daily_budget || c.dailyBudget) || 0), 0);

  const healthScoreData = {
    roas: accountInsights?.roas,
    cpa: accountInsights?.cpa,
    adSetsExitedLearning,
    totalAdSets,
    avgCreativeHealth,
    budgetUtilization: totalBudget > 0 ? totalSpend / totalBudget : null,
  };

  const overallHealth = accountHealthScore(healthScoreData, thresholds);

  // Budget allocation analysis
  const campaignsForBudget = campaignVerdicts.map(c => ({
    spend: c.spend,
    funnelCategory: c.funnelCategory,
  }));
  const budgetAnalysis = analyzeBudgetAllocation(campaignsForBudget, thresholds);

  return {
    actions: actions.slice(0, 20), // Top 20 actions
    allActions: actions,
    overallHealth,
    healthScoreData,
    campaignVerdicts,
    adSetVerdicts,
    adVerdicts,
    budgetAnalysis,
    accountInsights,
    summary: {
      totalCampaigns: campaigns.length,
      totalAdSets,
      totalAds: adVerdicts.length,
      adSetsExitedLearning,
      avgCreativeHealth: avgCreativeHealth ? Math.round(avgCreativeHealth) : null,
      killCount: actions.filter(a => a.signal === 'KILL').length,
      scaleCount: actions.filter(a => a.signal === 'SCALE').length,
      iterateCount: actions.filter(a => a.signal === 'ITERATE').length,
      newConceptCount: actions.filter(a => a.signal === 'NEW CONCEPT').length,
    },
  };
}
