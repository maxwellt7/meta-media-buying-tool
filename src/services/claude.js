/**
 * Claude API Integration Service
 * 
 * Provides AI-powered features:
 * 1. Daily briefing generation from metrics
 * 2. Creative brief generation when NEW CONCEPT triggered
 * 3. Anomaly explanations for metric deviations
 * 
 * Uses Anthropic API with mcp_servers parameter for GoMarble integration.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_STORAGE_KEY = 'claude_api_key';

// Load saved key from localStorage
let _apiKey = null;
try {
  _apiKey = localStorage.getItem(CLAUDE_STORAGE_KEY) || null;
  if (_apiKey) console.log('[Claude] API key loaded from storage');
} catch {}

export function configureClaudeAPI(apiKey) {
  _apiKey = apiKey;
  try {
    if (apiKey) localStorage.setItem(CLAUDE_STORAGE_KEY, apiKey);
    else localStorage.removeItem(CLAUDE_STORAGE_KEY);
  } catch {}
}

export function hasClaudeKey() {
  return !!_apiKey;
}

// ─── System Prompt ───────────────────────────────────────────────────────────

import PLAYBOOK_KNOWLEDGE from '../config/playbook.js';

const SYSTEM_PROMPT = `You are a senior Meta Ads media buyer analyst with $100MM+ in managed spend. You analyze campaign data and provide actionable recommendations based on the comprehensive Meta Ads Playbook below.

You have deep expertise in:
- The 3-step framework: Tracking → Creative Testing (ABO) → Scaling (CBO Prospecting)
- How Meta's algorithm actually works (the feedback loop, creative hogging, doom loops)
- Creative warm-up strategy: prove winners in ABO before moving to CBO scale campaigns
- Kill/Scale/Iterate decision framework with specific numeric thresholds
- Budget allocation, audience strategy, measurement (MER, CAPI, incrementality)

CRITICAL RULES:
- Always recommend the ABO testing → CBO scaling pipeline. Never recommend testing creative in a CBO campaign.
- Creative is the new targeting. The Big Idea outranks polish.
- One ad per ad set in testing campaigns (isolates performance).
- Warm up creatives (50+ conversions) before scaling.
- Kill at ≥ 2-3× target CPA with no conversions. No exceptions.
- Scale CBO budgets 10-15% per day max. Feed fresh winners to fight fatigue.
- For LAL audiences, ALWAYS sync to CRM — these are living audiences.
- Trust the algorithm: never constrain language, demographics, or placements.
- ASC is for high-SKU e-com only. Skip for lead gen / single-SKU funnels.

Be concise, specific, and data-driven. Use exact numbers. Structure output clearly with headers and bullet points.

${PLAYBOOK_KNOWLEDGE}`;

// ─── Daily Briefing ──────────────────────────────────────────────────────────

/**
 * Generate a natural language daily briefing from processed account data.
 */
export async function generateDailyBriefing(processedData) {
  if (!_apiKey) return generateLocalBriefing(processedData);

  const prompt = `Generate a concise daily briefing for this Meta ad account. Focus on the 3 most important insights and actions.

Account Data:
- Overall Health Score: ${processedData.overallHealth}/100
- Total Spend (7d): $${processedData.accountInsights?.spend?.toFixed(2)}
- Blended ROAS: ${processedData.accountInsights?.roas?.toFixed(2)}×
- Blended CPA: $${processedData.accountInsights?.cpa?.toFixed(2)}
- Total Conversions: ${processedData.accountInsights?.conversions}
- CTR: ${processedData.accountInsights?.ctr?.toFixed(2)}%
- Ad Sets Exited Learning: ${processedData.summary.adSetsExitedLearning}/${processedData.summary.totalAdSets}

Signals: ${processedData.summary.killCount} Kill, ${processedData.summary.scaleCount} Scale, ${processedData.summary.iterateCount} Iterate, ${processedData.summary.newConceptCount} New Concept

Top 3 Actions:
${processedData.actions.slice(0, 3).map((a, i) => `${i + 1}. [${a.signal}] ${a.entityName}: ${a.reason}`).join('\n')}

Format as a brief executive summary (3-4 sentences), then 3 bullet-point action items.`;

  try {
    const response = await callClaudeAPI(prompt);
    return response;
  } catch (err) {
    console.error('Claude API error:', err);
    return generateLocalBriefing(processedData);
  }
}

/**
 * Generate a creative brief when NEW CONCEPT signal is triggered.
 */
export async function generateCreativeBrief(adData) {
  if (!_apiKey) return generateLocalCreativeBrief(adData);

  const prompt = `Generate a creative brief for new Meta ad concepts. The current creatives are fatigued.

Current Performance:
- Ad Set: ${adData.adSetName}
- Campaign: ${adData.campaignName}
- Current ROAS: ${adData.roas?.toFixed(2)}×
- Current CTR: ${adData.ctr?.toFixed(2)}%
- Frequency: ${adData.frequency?.toFixed(1)}
- Days Running: ${adData.daysRunning}

Provide:
1. 3 new concept angles (problem-awareness, differentiation, social proof)
2. Recommended formats (video hooks, carousel layouts, UGC styles)
3. 2 headline variations per concept
4. Testing methodology (3-2-2 setup)`;

  try {
    return await callClaudeAPI(prompt);
  } catch (err) {
    console.error('Claude API error:', err);
    return generateLocalCreativeBrief(adData);
  }
}

/**
 * Generate an explanation for anomalous metric changes.
 */
export async function explainAnomaly(metric, currentValue, historicalAvg, entityName) {
  if (!_apiKey) return generateLocalAnomalyExplanation(metric, currentValue, historicalAvg);

  const changePercent = ((currentValue - historicalAvg) / historicalAvg * 100).toFixed(0);
  const prompt = `Explain a ${changePercent}% ${currentValue > historicalAvg ? 'increase' : 'decrease'} in ${metric} for "${entityName}".

Current: ${currentValue}
Historical Average: ${historicalAvg}
Change: ${changePercent}%

Consider: seasonality, competition changes, creative fatigue, audience saturation, algorithm learning, platform changes. Be concise (2-3 sentences).`;

  try {
    return await callClaudeAPI(prompt);
  } catch {
    return generateLocalAnomalyExplanation(metric, currentValue, historicalAvg);
  }
}

// ─── API Call ────────────────────────────────────────────────────────────────

async function callClaudeAPI(userMessage) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': _apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || 'No response generated.';
}

// ─── Local Fallback Generators ───────────────────────────────────────────────

function generateLocalBriefing(data) {
  const { overallHealth, accountInsights, summary, actions } = data;
  const ins = accountInsights || {};

  let briefing = `**Daily Briefing — Account Health: ${overallHealth}/100**\n\n`;

  if (overallHealth >= 80) {
    briefing += `Account is performing well. `;
  } else if (overallHealth >= 50) {
    briefing += `Account needs attention — several metrics approaching thresholds. `;
  } else {
    briefing += `⚠️ Account health critical — immediate action required. `;
  }

  briefing += `Blended ROAS at ${ins.roas?.toFixed(2) || '—'}× with $${ins.spend?.toFixed(0) || '0'} spend. `;
  briefing += `${summary.adSetsExitedLearning}/${summary.totalAdSets} ad sets have exited learning phase.\n\n`;

  briefing += `**Signal Summary:** ${summary.killCount} Kill · ${summary.scaleCount} Scale · ${summary.iterateCount} Iterate · ${summary.newConceptCount} New Concept\n\n`;

  if (actions.length > 0) {
    briefing += `**Priority Actions:**\n`;
    actions.slice(0, 3).forEach((a, i) => {
      briefing += `${i + 1}. **[${a.signal}]** ${a.entityName} — ${a.action}\n`;
    });
  } else {
    briefing += `✅ No urgent actions. All campaigns within target thresholds.`;
  }

  return briefing;
}

function generateLocalCreativeBrief(adData) {
  return `**Creative Brief — New Concepts Needed**

**Context:** Current creatives in "${adData.adSetName}" are fatigued (frequency: ${adData.frequency?.toFixed(1)}, CTR declining).

**Recommended Concept Angles:**
1. **Problem-Awareness:** Lead with the pain point your product solves. Hook: "Still dealing with [problem]?"
2. **Social Proof:** UGC testimonial format with real customer results. Hook: "I didn't believe it until..."
3. **Offer-Led:** Time-sensitive discount with urgency. Hook: "Last chance — [X]% off ends tonight"

**Recommended Formats:**
- Reels (9:16 vertical, 15-30 sec, audio-on) — highest engagement
- Carousel (product showcase + benefits) — lowest CPA historically
- UGC-style video — 4× higher CTR than branded content

**Testing Setup (3-2-2 Method):**
- 3 creatives (one per concept angle above)
- 2 primary text variations per creative
- 2 headline variations per creative
- Run via Dynamic Creative for 4-5 days minimum
- Budget: 3× your AOV per creative before judging`;
}

function generateLocalAnomalyExplanation(metric, current, historical) {
  const change = ((current - historical) / historical * 100).toFixed(0);
  const direction = current > historical ? 'increase' : 'decrease';

  const explanations = {
    cpa: direction === 'increase'
      ? `CPA rose ${Math.abs(change)}% above historical average. This may indicate creative fatigue, audience saturation, or increased competition. Check frequency and CTR trends to diagnose.`
      : `CPA improved ${Math.abs(change)}% below historical average. This could be driven by fresh creative, improved targeting, or seasonal conversion rate improvements.`,
    roas: direction === 'decrease'
      ? `ROAS dropped ${Math.abs(change)}% below historical average. Likely causes: rising CPMs, declining conversion rate, or creative fatigue reducing engagement quality.`
      : `ROAS improved ${Math.abs(change)}% above historical average. Potential drivers: strong creative performance, favorable auction dynamics, or improved landing page conversion rate.`,
    ctr: direction === 'decrease'
      ? `CTR declined ${Math.abs(change)}% — likely creative fatigue or audience over-saturation. Check frequency (>2.5 = concern) and consider new hooks/formats.`
      : `CTR improved ${Math.abs(change)}% — fresh creative or new audience segments responding well. Monitor if this translates to better CPA.`,
    cpm: direction === 'increase'
      ? `CPM increased ${Math.abs(change)}% — this could be seasonal competition (Q4 sees 25-66% surges), audience size constraints, or platform-wide cost inflation.`
      : `CPM decreased ${Math.abs(change)}% — favorable auction conditions. Good time to scale if conversion metrics hold.`,
  };

  return explanations[metric] || `${metric} changed ${change}% from historical average. Further analysis recommended.`;
}

// ─── Chat Advisor ────────────────────────────────────────────────────────────

/**
 * Send a multi-turn chat message with full account data context.
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @param {object} processedData - Current processed account data
 * @returns {Promise<string>} Assistant response text
 */
export async function sendChatMessage(messages, processedData) {
  if (!_apiKey) {
    return 'I need an Anthropic API key to respond. Please add your key in the **Settings** tab under "Claude API Key".';
  }

  const ins = processedData?.accountInsights || {};
  const summary = processedData?.summary || {};
  const thresholds = processedData?.thresholds || {};
  const budgetAnalysis = processedData?.budgetAnalysis || {};
  const actions = processedData?.actions || [];
  const campaigns = processedData?.campaigns || [];

  const campaignVerdicts = campaigns.slice(0, 10).map(c =>
    `- ${c.name}: ${c.verdict || 'N/A'} | ROAS ${c.roas?.toFixed(2) || '—'}× | CPA $${c.cpa?.toFixed(2) || '—'} | Spend $${c.spend?.toFixed(2) || '—'}`
  ).join('\n');

  const topActions = actions.slice(0, 5).map((a, i) =>
    `${i + 1}. [${a.signal}] ${a.entityName}: ${a.reason}`
  ).join('\n');

  const chatSystemPrompt = `${SYSTEM_PROMPT}

You are the user's personal Meta Ads advisor. Answer their questions using the live account data below. Be conversational but data-driven. Reference specific numbers. If you don't have enough data to answer, say so.

── LIVE ACCOUNT DATA ──
Health Score: ${processedData?.overallHealth ?? '—'}/100
Total Spend (7d): $${ins.spend?.toFixed(2) || '—'}
Blended ROAS: ${ins.roas?.toFixed(2) || '—'}×
Blended CPA: $${ins.cpa?.toFixed(2) || '—'}
CTR: ${ins.ctr?.toFixed(2) || '—'}%
CPM: $${ins.cpm?.toFixed(2) || '—'}
Conversions: ${ins.conversions ?? '—'}
Impressions: ${ins.impressions ?? '—'}

── SIGNALS ──
Kill: ${summary.killCount ?? 0} | Scale: ${summary.scaleCount ?? 0} | Iterate: ${summary.iterateCount ?? 0} | New Concept: ${summary.newConceptCount ?? 0}
Ad Sets Exited Learning: ${summary.adSetsExitedLearning ?? '—'}/${summary.totalAdSets ?? '—'}

── TOP ACTIONS ──
${topActions || 'No actions pending.'}

── CAMPAIGN VERDICTS ──
${campaignVerdicts || 'No campaign data available.'}

── BUDGET ALLOCATION ──
Prospecting: ${budgetAnalysis.prospectingPct ?? '—'}% | Retargeting: ${budgetAnalysis.retargetingPct ?? '—'}% | Testing: ${budgetAnalysis.testingPct ?? '—'}%

── THRESHOLDS ──
Target CPA: $${thresholds.targetCPA ?? '—'} | Target ROAS: ${thresholds.targetROAS ?? '—'}× | Max Frequency: ${thresholds.maxFrequency ?? '—'}`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: chatSystemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'No response generated.';
  } catch (err) {
    console.error('Chat API error:', err);
    return `Sorry, I couldn't process that request. Error: ${err.message}`;
  }
}

export default {
  configureClaudeAPI,
  generateDailyBriefing,
  generateCreativeBrief,
  explainAnomaly,
  sendChatMessage,
};
