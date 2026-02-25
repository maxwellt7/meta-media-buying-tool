/**
 * GoMarble MCP Service Layer
 * Wraps all 16 Facebook Ads API endpoints available through GoMarble MCP.
 * Integrates with the cache layer to reduce API calls.
 *
 * In production, calls are routed through the Claude API with mcp_servers parameter
 * pointing to GoMarble's SSE endpoint: https://apps.gomarble.ai/mcp-api/sse
 *
 * For local development/testing, this module also supports direct REST calls
 * and mock data mode.
 */

import cache, { TTL } from '../utils/cache.js';

// ─── Configuration ──────────────────────────────────────────────────────────

// Bridge server handles MCP protocol — browser just calls REST
const MCP_BRIDGE_BASE = '/api/mcp';
const GOMARBLE_SSE_ENDPOINT = 'https://apps.gomarble.ai/mcp-api/sse';
const STORAGE_KEY = 'gomarble_config';

// Load saved config from localStorage (survives page refresh)
function loadSavedConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate: last_7d default was too narrow, upgrade to last_30d
      if (parsed.datePreset === 'last_7d') {
        parsed.datePreset = 'last_30d';
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch { /* ignore parse errors */ }
  return null;
}

const savedConfig = loadSavedConfig();

const envApiKey = import.meta.env.VITE_GOMARBLE_API_KEY || null;
const resolvedApiKey = savedConfig?.apiKey || envApiKey || null;

// Auto-detect mode: if API key exists, default to 'direct' instead of 'mock'
const resolvedMode = savedConfig?.mode || (resolvedApiKey ? 'direct' : 'mock');

let _config = {
  mode: resolvedMode,
  apiKey: resolvedApiKey,
  accountId: savedConfig?.accountId || null,
  datePreset: savedConfig?.datePreset || 'last_30d',
  mcpServerUrl: GOMARBLE_SSE_ENDPOINT,
};

if (savedConfig) {
  console.log(`[GoMarble] Restored config: mode=${_config.mode}, account=${_config.accountId || 'none'}, datePreset=${_config.datePreset}`);
} else if (resolvedApiKey) {
  console.log(`[GoMarble] Auto-detected API key, using direct mode`);
}

export function configureGoMarble(overrides) {
  _config = { ..._config, ...overrides };
  // Persist to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: _config.mode,
      apiKey: _config.apiKey,
      accountId: _config.accountId,
      datePreset: _config.datePreset,
    }));
  } catch { /* ignore storage errors */ }
  cache.clear();
}

export function getConfig() {
  return { ..._config };
}

// ─── MCP Call Wrapper ────────────────────────────────────────────────────────

/**
 * Execute a GoMarble MCP tool call.
 * Routes through the configured mode (mock / mcp / direct).
 */
async function mcpCall(toolName, params = {}) {
  const cacheKey = cache.makeKey(toolName, params);
  const ttl = getTTLForTool(toolName);

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let result;

  switch (_config.mode) {
    case 'mock':
      result = await getMockData(toolName, params);
      break;
    case 'mcp':
      result = await executeMCPTool(toolName, params);
      break;
    case 'direct':
      result = await executeDirectCall(toolName, params);
      break;
    default:
      throw new Error(`Unknown GoMarble mode: ${_config.mode}`);
  }

  // Cache the result
  cache.set(cacheKey, result, ttl);
  return result;
}

/**
 * Execute via Claude API with MCP servers parameter
 */
async function executeMCPTool(toolName, params) {
  return executeDirectCall(toolName, params);
}

/**
 * Call GoMarble MCP tool via the local bridge server.
 * The bridge maintains the proper MCP SSE session server-side.
 * Browser just makes simple REST calls.
 */
async function executeDirectCall(toolName, params) {
  // Try up to 2 times — second attempt triggers bridge reconnect
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      console.log(`[GoMarble] Calling ${toolName} via bridge (attempt ${attempt + 1}/2)...`);

      const response = await fetch(`${MCP_BRIDGE_BASE}/tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, arguments: params }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        const errMsg = errData.error || '';

        // If session error on first attempt, trigger reconnect and retry
        if (attempt === 0 && (errMsg.includes('transport') || errMsg.includes('session') || errMsg.includes('Session'))) {
          console.log(`[GoMarble] Session error — triggering reconnect...`);
          await fetch(`${MCP_BRIDGE_BASE}/reconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: _config.apiKey }) }).catch(() => {});
          continue;
        }

        // On final attempt, throw instead of silently falling back to mock
        throw new Error(`Bridge error for ${toolName}: ${errMsg}`);
      }

      const data = await response.json();
      console.log(`[GoMarble] ${toolName} ✅`);
      return data;

    } catch (err) {
      if (attempt === 0) {
        console.warn(`[GoMarble] ${toolName} attempt 1 failed: ${err.message}. Retrying...`);
        await fetch(`${MCP_BRIDGE_BASE}/reconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: _config.apiKey }) }).catch(() => {});
        continue;
      }
      // Final attempt failed — propagate error so UI can show it
      console.error(`[GoMarble] ${toolName} failed after 2 attempts: ${err.message}`);
      throw err;
    }
  }
}

/**
 * Determine TTL based on the tool type
 */
function getTTLForTool(toolName) {
  if (toolName.includes('insights')) return TTL.INSIGHTS_REALTIME;
  if (toolName.includes('creative')) return TTL.CREATIVE_DETAILS;
  return TTL.ACCOUNT_STRUCTURE;
}

// ─── Standard Insights Fields ────────────────────────────────────────────────

const INSIGHT_FIELDS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cpc',
  'reach', 'frequency', 'actions', 'cost_per_action_type', 'purchase_roas',
];

// ─── Account-Level Endpoints ─────────────────────────────────────────────────
// GoMarble tool names are prefixed: facebook_list_ad_accounts, facebook_get_details_of_ad_account, etc.

/**
 * List all ad accounts accessible to the authenticated user
 */
export async function listAdAccounts() {
  return mcpCall('facebook_list_ad_accounts');
}

/**
 * Get details for a specific ad account
 */
export async function getAccountDetails(accountId = _config.accountId) {
  return mcpCall('facebook_get_details_of_ad_account', { act_id: accountId });
}

/**
 * Get account-level insights (spend, ROAS, CPA, CTR, CPM, etc.)
 */
export async function getAccountInsights(accountId = _config.accountId, datePreset = _config.datePreset) {
  return mcpCall('facebook_get_adaccount_insights', {
    act_id: accountId,
    fields: INSIGHT_FIELDS,
    date_preset: datePreset,
  });
}

// ─── Campaign-Level Endpoints ────────────────────────────────────────────────

/**
 * List all campaigns in an account (via account insights or details)
 */
export async function getCampaignsInAccount(accountId = _config.accountId) {
  return mcpCall('facebook_get_details_of_ad_account', { act_id: accountId });
}

/**
 * Get details for a specific campaign
 */
export async function getCampaignDetails(campaignId, accountId = _config.accountId) {
  return mcpCall('facebook_get_campaign_details', { campaign_id: campaignId, act_id: accountId });
}

/**
 * Get campaign-level insights
 */
export async function getCampaignInsights(campaignId, accountId = _config.accountId) {
  return mcpCall('facebook_get_campaign_details', {
    campaign_id: campaignId,
    act_id: accountId,
  });
}

// ─── Ad Set-Level Endpoints ──────────────────────────────────────────────────

/**
 * List all ad sets in an account
 */
export async function getAdSetsInAccount(accountId = _config.accountId) {
  return mcpCall('facebook_get_details_of_ad_account', { act_id: accountId });
}

/**
 * List ad sets in a specific campaign
 */
export async function getAdSetsInCampaign(campaignId, accountId = _config.accountId) {
  return mcpCall('facebook_get_campaign_details', { campaign_id: campaignId, act_id: accountId });
}

/**
 * Get details for a specific ad set
 */
export async function getAdSetDetails(adsetId, accountId = _config.accountId) {
  return mcpCall('facebook_get_adset_details', { adset_id: adsetId, act_id: accountId });
}

/**
 * Get ad set-level insights
 */
export async function getAdSetInsights(adsetId, accountId = _config.accountId) {
  return mcpCall('facebook_get_adset_details', {
    adset_id: adsetId,
    act_id: accountId,
  });
}

// ─── Ad-Level Endpoints ──────────────────────────────────────────────────────

/**
 * List all ads in an account
 */
export async function getAdsInAccount(accountId = _config.accountId) {
  return mcpCall('facebook_get_details_of_ad_account', { act_id: accountId });
}

/**
 * List ads in a specific campaign
 */
export async function getAdsInCampaign(campaignId, accountId = _config.accountId) {
  return mcpCall('facebook_get_campaign_details', { campaign_id: campaignId, act_id: accountId });
}

/**
 * List ads in a specific ad set
 */
export async function getAdsInAdSet(adsetId, accountId = _config.accountId) {
  return mcpCall('facebook_get_adset_details', { adset_id: adsetId, act_id: accountId });
}

/**
 * Get details for a specific ad
 */
export async function getAdDetails(adId) {
  return mcpCall('facebook_get_adset_details', { adset_id: adId });
}

/**
 * Get ad-level insights
 */
export async function getAdInsights(adId) {
  return mcpCall('facebook_get_adset_details', {
    adset_id: adId,
  });
}

// ─── Creative Endpoints ──────────────────────────────────────────────────────

/**
 * Get creative details for an ad
 */
export async function getCreativesForAd(adId) {
  return mcpCall('facebook_analyze_ad_creative_by_id_or_url', { ad_id: adId });
}

/**
 * Get detailed creative information
 */
export async function getAdCreativeDetails(creativeId) {
  return mcpCall('facebook_analyze_ad_creative_by_id_or_url', { creative_id: creativeId });
}

// ─── Batch / Aggregate Fetchers ──────────────────────────────────────────────

/**
 * Fetch account/campaign/adset insights in parallel for a given date preset.
 */
async function fetchInsightsByLevel(accountId, datePreset) {
  const [accountResult, campaignResult, adsetResult] = await Promise.all([
    mcpCall('facebook_get_adaccount_insights', {
      act_id: accountId,
      fields: INSIGHT_FIELDS,
      date_preset: datePreset,
      level: 'account',
    }),
    mcpCall('facebook_get_adaccount_insights', {
      act_id: accountId,
      fields: [...INSIGHT_FIELDS, 'campaign_id', 'campaign_name'],
      date_preset: datePreset,
      level: 'campaign',
    }),
    mcpCall('facebook_get_adaccount_insights', {
      act_id: accountId,
      fields: [...INSIGHT_FIELDS, 'adset_id', 'adset_name', 'campaign_id', 'campaign_name'],
      date_preset: datePreset,
      level: 'adset',
    }),
  ]);
  return {
    accountRows: accountResult?.data || [],
    campaignRows: campaignResult?.data || [],
    adsetRows: adsetResult?.data || [],
  };
}

/**
 * Fetch full account data using GoMarble's insights API with level breakdowns.
 * Uses 3 parallel calls (account / campaign / adset level) instead of nested per-entity calls.
 */
export async function fetchFullAccountData(accountId = _config.accountId) {
  if (_config.mode === 'mock') {
    return fetchFullAccountDataMock(accountId);
  }

  const datePreset = _config.datePreset || 'last_30d';
  console.log(`[GoMarble] Fetching full account data for ${accountId} (${datePreset})...`);

  let { accountRows, campaignRows, adsetRows } = await fetchInsightsByLevel(accountId, datePreset);

  // Auto-widen: if selected range returned empty, try last_30d then last_90d
  if (accountRows.length === 0) {
    const fallbacks = ['last_30d', 'last_90d'].filter(p => p !== datePreset);
    for (const fallback of fallbacks) {
      console.log(`[GoMarble] No data for ${datePreset}, trying ${fallback}...`);
      const wider = await fetchInsightsByLevel(accountId, fallback);
      if (wider.accountRows.length > 0) {
        accountRows = wider.accountRows;
        campaignRows = wider.campaignRows;
        adsetRows = wider.adsetRows;
        // Update config so subsequent calls use the working range
        _config.datePreset = fallback;
        console.log(`[GoMarble] Found data with ${fallback}`);
        break;
      }
    }
  }

  const isEmpty = accountRows.length === 0 && campaignRows.length === 0;

  console.log(`[GoMarble] Got ${accountRows.length} account, ${campaignRows.length} campaign, ${adsetRows.length} adset rows${isEmpty ? ' (EMPTY — try a longer date range)' : ''}`);

  // Transform GoMarble response into the structure our dashboard expects
  const accountInsights = accountRows.length > 0 ? transformInsights(accountRows[0]) : null;

  // Group ad sets by campaign
  const adsetsByCampaign = {};
  adsetRows.forEach(row => {
    const cid = row.campaign_id;
    if (!adsetsByCampaign[cid]) adsetsByCampaign[cid] = [];
    adsetsByCampaign[cid].push({
      id: row.adset_id,
      name: row.adset_name,
      status: 'ACTIVE',
      campaign_id: row.campaign_id,
      insights: transformInsights(row),
      ads: [], // GoMarble doesn't have per-ad breakdown in insights — leave empty
    });
  });

  // Build campaign hierarchy
  const campaigns = campaignRows.map(row => ({
    id: row.campaign_id,
    name: row.campaign_name,
    status: 'ACTIVE',
    objective: 'OUTCOME_SALES',
    daily_budget: null,
    insights: transformInsights(row),
    adSets: adsetsByCampaign[row.campaign_id] || [],
  }));

  return {
    account: {
      id: accountId,
      name: accountRows[0]?.account_name || accountId,
      insights: accountInsights,
    },
    campaigns,
    isEmpty,
    datePreset: _config.datePreset,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Transform a GoMarble insights row into our normalized format.
 * Handles both ecommerce (purchase/ROAS) and lead gen (link_click, landing_page_view) accounts.
 * All numeric fields from GoMarble come as strings — parse them safely.
 * @param {object} row - Raw insights row from GoMarble API
 * @returns {object|null} Normalized insights object
 */
function transformInsights(row) {
  if (!row) return null;

  const spend = parseFloat(row.spend) || 0;
  const impressions = parseInt(row.impressions) || 0;
  const clicks = parseInt(row.clicks) || 0;
  const reach = parseInt(row.reach) || 0;
  const frequency = parseFloat(row.frequency) || 0;

  // Extract conversions from actions array (GoMarble returns action_type/value pairs)
  const actions = Array.isArray(row.actions) ? row.actions : [];

  // Purchase conversions (ecommerce)
  const purchaseAction = actions.find(a =>
    a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
  );
  const purchases = purchaseAction ? parseInt(purchaseAction.value) || 0 : 0;

  // Lead conversions
  const leadAction = actions.find(a =>
    a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead'
  );
  const leads = leadAction ? parseInt(leadAction.value) || 0 : 0;

  // Lead gen fallback: use landing_page_view or link_click as conversion proxy
  const landingPageAction = actions.find(a => a.action_type === 'landing_page_view');
  const linkClickAction = actions.find(a => a.action_type === 'link_click');
  const landingPageViews = landingPageAction ? parseInt(landingPageAction.value) || 0 : 0;
  const linkClicks = linkClickAction ? parseInt(linkClickAction.value) || 0 : 0;

  // Use the best available conversion metric
  const totalConversions = purchases || leads || landingPageViews || 0;

  // Revenue from purchase_roas
  const roas = row.purchase_roas
    ? parseFloat(Array.isArray(row.purchase_roas) ? row.purchase_roas[0]?.value : row.purchase_roas)
    : null;
  const revenue = roas && spend ? spend * roas : 0;

  // CPA from cost_per_action_type
  const cpas = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
  const purchaseCpa = cpas.find(a =>
    a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
  );
  const leadCpa = cpas.find(a =>
    a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead'
  );
  const landingPageCpa = cpas.find(a => a.action_type === 'landing_page_view');
  const linkClickCpa = cpas.find(a => a.action_type === 'link_click');

  let cpa = null;
  if (purchaseCpa?.value != null) cpa = parseFloat(purchaseCpa.value);
  else if (leadCpa?.value != null) cpa = parseFloat(leadCpa.value);
  else if (landingPageCpa?.value != null) cpa = parseFloat(landingPageCpa.value);
  else if (linkClickCpa?.value != null) cpa = parseFloat(linkClickCpa.value);
  else if (totalConversions > 0 && spend > 0) cpa = spend / totalConversions;

  // Video metrics (may come as arrays with {action_type, value} or plain numbers)
  const v3s = row.video_3_sec_watched_actions;
  const v15s = row.video_15_sec_watched_actions;
  const video3sViews = Array.isArray(v3s) ? parseInt(v3s[0]?.value || 0) : parseInt(v3s || 0);
  const video15sViews = Array.isArray(v15s) ? parseInt(v15s[0]?.value || 0) : parseInt(v15s || 0);

  // Determine date range days for synthetic daily breakdown
  const days = getDaysBetween(row.date_start, row.date_stop) || 7;

  return {
    spend,
    impressions,
    clicks,
    conversions: totalConversions,
    revenue,
    reach,
    frequency,
    ctr: parseFloat(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0),
    cpc: parseFloat(row.cpc) || (clicks > 0 ? spend / clicks : null),
    cpm: parseFloat(row.cpm) || (impressions > 0 ? (spend / impressions) * 1000 : null),
    cpa: cpa != null ? parseFloat(cpa) : null,
    roas,
    purchase_roas: roas,
    // Lead gen specific metrics
    landing_page_views: landingPageViews,
    link_clicks: linkClicks,
    leads,
    video_3_sec_watched_actions: video3sViews,
    video_15_sec_watched_actions: video15sViews,
    cost_per_action_type: cpas,
    actions, // preserve raw actions for debugging
    date_start: row.date_start,
    date_stop: row.date_stop,
    daily: generateSyntheticDaily(days, { spend, conversions: totalConversions, ctr: parseFloat(row.ctr) || 0, cpm: parseFloat(row.cpm) || 0, roas }),
  };
}

/**
 * Calculate days between two date strings.
 * @param {string} start - ISO date string (YYYY-MM-DD)
 * @param {string} end - ISO date string (YYYY-MM-DD)
 * @returns {number|null}
 */
function getDaysBetween(start, end) {
  if (!start || !end) return null;
  const diff = new Date(end) - new Date(start);
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Generate synthetic daily breakdown from aggregate data for trend charts.
 */
function generateSyntheticDaily(days, base) {
  const breakdown = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const v = () => 0.8 + Math.random() * 0.4;
    const dailySpend = +(base.spend / days * v()).toFixed(2);
    const dailyConv = Math.max(0, Math.round(base.conversions / days * v()));
    breakdown.push({
      date: date.toISOString().split('T')[0],
      spend: dailySpend,
      conversions: dailyConv,
      ctr: +(base.ctr * v()).toFixed(2),
      cpm: +(base.cpm * v()).toFixed(2),
      roas: base.roas ? +(base.roas * v()).toFixed(2) : null,
      cpa: dailyConv > 0 ? +(dailySpend / dailyConv).toFixed(2) : null,
    });
  }
  return breakdown;
}

/**
 * Fetch full account data using mock data (original logic).
 * Calls mock handlers directly with short tool names to avoid name mapping issues.
 */
async function fetchFullAccountDataMock(accountId) {
  const [accountDetails, accountInsights, campaignsResp] = await Promise.all([
    getMockData('get_account_details', { account_id: accountId }),
    getMockData('get_account_insights', { account_id: accountId }),
    getMockData('get_campaigns_in_account', { account_id: accountId }),
  ]);

  const campaignList = campaignsResp.data || [];

  const campaignData = await Promise.all(
    campaignList.map(async (campaign) => {
      const [insights, adSetsResp] = await Promise.all([
        getMockData('get_campaign_insights', { campaign_id: campaign.id }),
        getMockData('get_adsets_in_campaign', { campaign_id: campaign.id }),
      ]);

      const adSetList = adSetsResp.data || [];

      const adSetData = await Promise.all(
        adSetList.map(async (adSet) => {
          const [adSetInsights, adsResp] = await Promise.all([
            getMockData('get_adset_insights', { adset_id: adSet.id }),
            getMockData('get_ads_in_adset', { adset_id: adSet.id }),
          ]);

          const adList = adsResp.data || [];

          const adData = await Promise.all(
            adList.map(async (ad) => {
              const adInsights = await getMockData('get_ad_insights', { ad_id: ad.id });
              return { ...ad, insights: adInsights };
            })
          );

          return { ...adSet, insights: adSetInsights, ads: adData };
        })
      );

      return { ...campaign, insights, adSets: adSetData };
    })
  );

  return {
    account: { ...accountDetails, insights: accountInsights },
    campaigns: campaignData,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch insights for multiple date ranges (for trend analysis)
 */
export async function fetchMultiPeriodInsights(entityType, entityId, datePresets = ['last_7d', 'last_30d']) {
  // For live mode, use the insights API directly
  if (_config.mode !== 'mock' && _config.accountId) {
    const levelMap = { account: 'account', campaign: 'campaign', adset: 'adset', ad: 'ad' };
    const results = await Promise.all(
      datePresets.map(preset =>
        mcpCall('facebook_get_adaccount_insights', {
          act_id: _config.accountId,
          fields: INSIGHT_FIELDS,
          date_preset: preset,
          level: levelMap[entityType] || 'account',
        })
      )
    );
    return datePresets.reduce((acc, preset, i) => {
      acc[preset] = results[i];
      return acc;
    }, {});
  }

  // Mock mode fallback
  const fetcher = {
    account: getAccountInsights,
    campaign: getCampaignInsights,
    adset: getAdSetInsights,
    ad: getAdInsights,
  }[entityType];
  if (!fetcher) throw new Error(`Unknown entity type: ${entityType}`);
  const results = await Promise.all(datePresets.map(() => fetcher(entityId)));
  return datePresets.reduce((acc, preset, i) => { acc[preset] = results[i]; return acc; }, {});
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

/**
 * Returns realistic mock data for development and testing.
 * Structured to match GoMarble's expected response format.
 */
async function getMockData(toolName, params) {
  // Simulate network latency
  await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

  const mockHandlers = {
    // Short names (used by mock mode fetcher)
    list_ad_accounts: () => ({
      data: [
        { id: 'act_123456789', name: 'Main Ecommerce Account', currency: 'USD', timezone: 'America/New_York', status: 'ACTIVE' },
      ],
    }),

    get_account_details: () => ({
      id: params.account_id || params.act_id || 'act_123456789',
      name: 'Main Ecommerce Account',
      currency: 'USD',
      timezone: 'America/New_York',
      status: 'ACTIVE',
      daily_budget: 1200,
      lifetime_budget: 0,
    }),

    get_account_insights: () => generateMockInsights('account', params),

    get_campaigns_in_account: () => ({
      data: [
        { id: 'camp_001', name: '[ASC] Broad Prospecting', status: 'ACTIVE', objective: 'OUTCOME_SALES', buying_type: 'AUCTION', budget_remaining: '4500', daily_budget: '700', special_ad_categories: [] },
        { id: 'camp_002', name: '[CBO] Creative Testing', status: 'ACTIVE', objective: 'OUTCOME_SALES', buying_type: 'AUCTION', budget_remaining: '2100', daily_budget: '300', special_ad_categories: [] },
        { id: 'camp_003', name: '[ABO] Retargeting - WV + ATC', status: 'ACTIVE', objective: 'OUTCOME_SALES', buying_type: 'AUCTION', budget_remaining: '800', daily_budget: '200', special_ad_categories: [] },
      ],
    }),

    get_campaign_details: () => ({
      id: params.campaign_id,
      name: getMockCampaignName(params.campaign_id),
      status: 'ACTIVE',
      objective: 'OUTCOME_SALES',
      buying_type: 'AUCTION',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: '700',
    }),

    get_campaign_insights: () => generateMockInsights('campaign', params),

    get_adsets_in_account: () => ({
      data: generateMockAdSets(),
    }),

    get_adsets_in_campaign: () => ({
      data: generateMockAdSets(params.campaign_id),
    }),

    get_adset_details: () => ({
      id: params.adset_id,
      name: `Ad Set ${params.adset_id}`,
      status: 'ACTIVE',
      targeting: { age_min: 25, age_max: 65, genders: [0] },
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: '150',
      optimization_goal: 'OFFSITE_CONVERSIONS',
    }),

    get_adset_insights: () => generateMockInsights('adset', params),

    get_ads_in_account: () => ({
      data: generateMockAds(),
    }),

    get_ads_in_campaign: () => ({
      data: generateMockAds(params.campaign_id),
    }),

    get_ads_in_adset: () => ({
      data: generateMockAds(null, params.adset_id),
    }),

    get_ad_details: () => ({
      id: params.ad_id,
      name: `Ad ${params.ad_id}`,
      status: 'ACTIVE',
      creative: { id: `cr_${params.ad_id}` },
    }),

    get_ad_insights: () => generateMockInsights('ad', params),

    get_creatives_for_ad: () => ({
      data: [{
        id: `cr_${params.ad_id}`,
        name: `Creative for ${params.ad_id}`,
        thumbnail_url: 'https://placehold.co/200x200/1e293b/8b5cf6?text=Ad',
        body: 'Transform your routine with our best-selling collection.',
        title: 'Shop Now - Limited Time',
        call_to_action_type: 'SHOP_NOW',
        object_type: Math.random() > 0.5 ? 'VIDEO' : 'IMAGE',
      }],
    }),

    get_ad_creative_details: () => ({
      id: params.creative_id,
      name: 'Product Showcase Video',
      body: 'Transform your routine with our best-selling collection. Free shipping on orders $50+.',
      title: 'Shop Now - Limited Time Offer',
      call_to_action_type: 'SHOP_NOW',
      object_type: 'VIDEO',
      thumbnail_url: 'https://placehold.co/400x400/1e293b/8b5cf6?text=Creative',
      image_url: null,
      video_url: 'https://example.com/video.mp4',
      link_url: 'https://example.com/shop',
    }),
  };

  // Also support facebook_ prefixed names → map to short names
  const aliasMap = {
    facebook_list_ad_accounts: 'list_ad_accounts',
    facebook_get_details_of_ad_account: 'get_account_details',
    facebook_get_adaccount_insights: 'get_account_insights',
    facebook_get_campaign_details: 'get_campaign_details',
    facebook_get_adset_details: 'get_adset_details',
    facebook_analyze_ad_creative_by_id_or_url: 'get_ad_creative_details',
  };

  const resolvedName = aliasMap[toolName] || toolName;
  const handler = mockHandlers[resolvedName];
  if (!handler) {
    console.warn(`No mock handler for GoMarble tool: ${toolName}`);
    return { data: [], error: `No mock for ${toolName}` };
  }

  return handler();
}

// ─── Mock Data Generators ────────────────────────────────────────────────────

function getMockCampaignName(id) {
  const names = {
    camp_001: '[ASC] Broad Prospecting',
    camp_002: '[CBO] Creative Testing',
    camp_003: '[ABO] Retargeting - WV + ATC',
  };
  return names[id] || `Campaign ${id}`;
}

function generateMockInsights(level, params) {
  const base = {
    account: { spend: 1150, impressions: 89000, clicks: 1210, conversions: 38, revenue: 4560, frequency: 1.8, reach: 49500 },
    campaign: { spend: 450, impressions: 32000, clicks: 420, conversions: 14, revenue: 1680, frequency: 2.1, reach: 15200 },
    adset: { spend: 180, impressions: 14000, clicks: 175, conversions: 6, revenue: 720, frequency: 2.4, reach: 5800 },
    ad: { spend: 85, impressions: 6500, clicks: 82, conversions: 3, revenue: 360, frequency: 2.2, reach: 2950 },
  }[level];

  // Add realistic variance
  const v = () => 0.7 + Math.random() * 0.6; // 0.7x to 1.3x variance

  const spend = +(base.spend * v()).toFixed(2);
  const impressions = Math.round(base.impressions * v());
  const clicks = Math.round(base.clicks * v());
  const conversions = Math.max(0, Math.round(base.conversions * v()));
  const revenue = +(base.revenue * v()).toFixed(2);
  const reach = Math.round(base.reach * v());
  const frequency = +(impressions / Math.max(reach, 1)).toFixed(2);

  const ctr = +(clicks / Math.max(impressions, 1) * 100).toFixed(2);
  const cpc = +(spend / Math.max(clicks, 1)).toFixed(2);
  const cpm = +(spend / Math.max(impressions, 1) * 1000).toFixed(2);
  const cpa = conversions > 0 ? +(spend / conversions).toFixed(2) : null;
  const roas = spend > 0 ? +(revenue / spend).toFixed(2) : null;

  // Video metrics (may not always be available)
  const video3sViews = Math.round(impressions * (0.25 + Math.random() * 0.2));
  const video15sViews = Math.round(video3sViews * (0.3 + Math.random() * 0.3));

  return {
    spend,
    impressions,
    clicks,
    reach,
    frequency,
    ctr,
    cpc,
    cpm,
    conversions,
    revenue,
    purchase_roas: roas,
    cost_per_action_type: cpa ? [{ action_type: 'purchase', value: cpa }] : [],
    video_3_sec_watched_actions: video3sViews,
    video_15_sec_watched_actions: video15sViews,
    date_start: getDateStart(params?.date_preset),
    date_stop: new Date().toISOString().split('T')[0],
    // Daily breakdown for trend analysis
    daily: generateDailyBreakdown(7, { spend: spend / 7, conversions: conversions / 7, ctr, cpm, roas }),
  };
}

function generateDailyBreakdown(days, baseDailyMetrics) {
  const breakdown = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const v = () => 0.75 + Math.random() * 0.5;
    const dailySpend = +(baseDailyMetrics.spend * v()).toFixed(2);
    const dailyConversions = Math.max(0, Math.round(baseDailyMetrics.conversions * v()));
    const dailyCtr = +(baseDailyMetrics.ctr * v()).toFixed(2);
    const dailyCpm = +(baseDailyMetrics.cpm * v()).toFixed(2);
    const dailyRoas = baseDailyMetrics.roas ? +(baseDailyMetrics.roas * v()).toFixed(2) : null;

    breakdown.push({
      date: date.toISOString().split('T')[0],
      spend: dailySpend,
      conversions: dailyConversions,
      ctr: dailyCtr,
      cpm: dailyCpm,
      roas: dailyRoas,
      cpa: dailyConversions > 0 ? +(dailySpend / dailyConversions).toFixed(2) : null,
    });
  }
  return breakdown;
}

function generateMockAdSets(campaignId = null) {
  const allAdSets = [
    { id: 'as_001', campaign_id: 'camp_001', name: 'Broad - 25-65 - All Genders', status: 'ACTIVE', daily_budget: '250', optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
    { id: 'as_002', campaign_id: 'camp_001', name: 'Broad - Lookalike 1%', status: 'ACTIVE', daily_budget: '200', optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
    { id: 'as_003', campaign_id: 'camp_002', name: 'Test - 3-2-2 Batch A', status: 'ACTIVE', daily_budget: '100', optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
    { id: 'as_004', campaign_id: 'camp_002', name: 'Test - 3-2-2 Batch B', status: 'ACTIVE', daily_budget: '100', optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
    { id: 'as_005', campaign_id: 'camp_003', name: 'RT - Website Visitors 1-7d', status: 'ACTIVE', daily_budget: '80', optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
    { id: 'as_006', campaign_id: 'camp_003', name: 'RT - Add to Cart 1-3d', status: 'ACTIVE', daily_budget: '70', optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
    { id: 'as_007', campaign_id: 'camp_003', name: 'RT - Engaged Users 7-30d', status: 'ACTIVE', daily_budget: '50', optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
  ];

  if (campaignId) return allAdSets.filter(as => as.campaign_id === campaignId);
  return allAdSets;
}

function generateMockAds(campaignId = null, adsetId = null) {
  const allAds = [
    { id: 'ad_001', adset_id: 'as_001', campaign_id: 'camp_001', name: 'UGC Testimonial - Sarah', status: 'ACTIVE', creative: { id: 'cr_001' } },
    { id: 'ad_002', adset_id: 'as_001', campaign_id: 'camp_001', name: 'Product Carousel - Best Sellers', status: 'ACTIVE', creative: { id: 'cr_002' } },
    { id: 'ad_003', adset_id: 'as_001', campaign_id: 'camp_001', name: 'Reel - Before/After', status: 'ACTIVE', creative: { id: 'cr_003' } },
    { id: 'ad_004', adset_id: 'as_002', campaign_id: 'camp_001', name: 'Static - Hero Product', status: 'ACTIVE', creative: { id: 'cr_004' } },
    { id: 'ad_005', adset_id: 'as_002', campaign_id: 'camp_001', name: 'Video - 3 Reasons Why', status: 'ACTIVE', creative: { id: 'cr_005' } },
    { id: 'ad_006', adset_id: 'as_003', campaign_id: 'camp_002', name: 'Test A1 - Problem Hook', status: 'ACTIVE', creative: { id: 'cr_006' } },
    { id: 'ad_007', adset_id: 'as_003', campaign_id: 'camp_002', name: 'Test A2 - Social Proof Hook', status: 'ACTIVE', creative: { id: 'cr_007' } },
    { id: 'ad_008', adset_id: 'as_004', campaign_id: 'camp_002', name: 'Test B1 - Offer-Led', status: 'ACTIVE', creative: { id: 'cr_008' } },
    { id: 'ad_009', adset_id: 'as_005', campaign_id: 'camp_003', name: 'RT - Dynamic Product Ad', status: 'ACTIVE', creative: { id: 'cr_009' } },
    { id: 'ad_010', adset_id: 'as_006', campaign_id: 'camp_003', name: 'RT - Cart Reminder', status: 'ACTIVE', creative: { id: 'cr_010' } },
    { id: 'ad_011', adset_id: 'as_007', campaign_id: 'camp_003', name: 'RT - Win Back Offer', status: 'ACTIVE', creative: { id: 'cr_011' } },
  ];

  if (adsetId) return allAds.filter(a => a.adset_id === adsetId);
  if (campaignId) return allAds.filter(a => a.campaign_id === campaignId);
  return allAds;
}

function getDateStart(preset) {
  const d = new Date();
  switch (preset) {
    case 'last_7d': d.setDate(d.getDate() - 7); break;
    case 'last_14d': d.setDate(d.getDate() - 14); break;
    case 'last_30d': d.setDate(d.getDate() - 30); break;
    case 'last_90d': d.setDate(d.getDate() - 90); break;
    default: d.setDate(d.getDate() - 7);
  }
  return d.toISOString().split('T')[0];
}

export default {
  configureGoMarble,
  getConfig,
  listAdAccounts,
  getAccountDetails,
  getAccountInsights,
  getCampaignsInAccount,
  getCampaignDetails,
  getCampaignInsights,
  getAdSetsInAccount,
  getAdSetsInCampaign,
  getAdSetDetails,
  getAdSetInsights,
  getAdsInAccount,
  getAdsInCampaign,
  getAdsInAdSet,
  getAdDetails,
  getAdInsights,
  getCreativesForAd,
  getAdCreativeDetails,
  fetchFullAccountData,
  fetchMultiPeriodInsights,
};
