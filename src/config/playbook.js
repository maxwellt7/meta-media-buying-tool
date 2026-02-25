/**
 * Meta Ads Playbook Knowledge Base
 * Compiled from Resources/ folder + compass artifact playbook.
 * Embedded into Claude's system prompt for the Chat Advisor.
 */

const PLAYBOOK_KNOWLEDGE = `
══════════════════════════════════════════════════════════════
META ADS PLAYBOOK KNOWLEDGE BASE (2024-2025)
══════════════════════════════════════════════════════════════

═══ HOW META'S TARGETING ALGORITHM ACTUALLY WORKS ═══

Meta takes your ad creative and starts testing it to different segments of your selected audience. It watches for fast, on-platform leading indicators like 3s video views, clicks, comments, reactions, shares, etc.

Whichever segment & creative shows signs of life first ends up getting the majority of your budget. This self-fulfilling feedback loop is why one creative will hog all the budget in CBO or ASC campaigns.

When you scale too far, Meta starts experimenting again with different segments of your audience. It will primarily use the ad(s) that have already spent when experimenting. If it can't find another pocket of the audience that reacts, it will spiral into a doom loop of inflated KPIs and crashing ROAS.

THE FIX: "Warm up" your creative and prove it as a winner BEFORE moving it into a scale campaign.

Best Case: You're warming up winning creatives and operating in a very large market where Meta can readily identify different winning audience segments.

Most Likely Case: You're dumping ad creatives into scale campaigns without warming them up and operating in a market dramatically smaller than you think — which makes you feel like you're hitting a glass ceiling when the reality is you probably just need better ad management and ad creatives.

═══ 3-STEP FRAMEWORK ($100MM+ PROVEN) ═══

From a media buyer who managed $100MM+ in profitable Meta spend across 25+ accounts (e-com, lead gen, SaaS, info). Framework vetted with Meta's own product execs. One told him flat-out: "Creative is the new targeting."

── STEP 1: TRACKING SETUP — BULLETPROOF YOUR DATA ──

• Dual-path events: Pixel + CAPI (Conversions API)
• If Events Manager shows ~2× the events you expect, you're golden — one hit from pixel, one from CAPI
• CAPI options: Gateway (Stape) for most clients, Hyros/TripleWhale/Zapier S2S for edge cases
• Always pass every Advanced Matching & fbp/fbc parameter Meta will take
• Keep the pixel clean ("pixel-poisoning" guardrails):
  - Fire conversions only from canonical success page or server-side logic
  - Suppress staging traffic, bots, QA hits, & duplicate page reloads
  - Audit last 7 days of raw events weekly — if counts don't line up, fix before scaling
• Attribution windows:
  - Let algo learn on Meta's default (7-day click / 1-day view)
  - For internal ROAS dashboards, use 1-day click — it mirrors the CRM every time

── STEP 2: CREATIVE TESTING — WHERE THE MONEY IS MADE ──

Format & specs:
• 9:16 video, 3-5 min, shot iPhone/UGC style (stretches across Reels, Stories, Feeds)
• Follow Meta safe zones for text/CTA placement
• Copy = short, 1-2 sentences + URL in text (shaves ~10% off CPA)
• Framework: Hook → Story → Education → CTA
• The Big Idea outranks polish. Always.

Testing Campaign Structure (ABO):
• One ad per ad set (CRITICAL — isolates creative performance)
• Budget: 1-3× target CPA per ad set daily
• Launch as many new videos as team can produce (20+/week in fastest orgs)
• Let run 3 FULL DAYS before judging — less = statistically useless
• KILL anything ≥ 2× target CPA with no conversions
• SCALE winners by +$100 (or +1× target CPA) every 3 days
• Goal: 50 conversions so the ad exits Learning; then duplicate freely — learnings stick
• No upper limit to number of ad-set/creative combinations in this campaign

── STEP 3: SCALING — THE PROSPECTING CAMPAIGN BLUEPRINT ──

Once you have ≥ 3 winners with 50+ conversions each, build a CBO ("Advantage Campaign Budget") prospecting campaign:

CBO PROSPECTING CAMPAIGN STRUCTURE:
1. Broad Interest Stack or Open Targeting Ad Set
   (excluding audiences from ad sets #2, #3, #4 AND existing customers)
   → 3-6 winning ads (can push to 15 per Meta insiders)

2. Pixel-Based Purchase Lookalike (10%)
   (excluding audiences from ad sets #3, #4 AND existing customers)
   → Same winning ads

3. CRM Purchase Lookalike (10%)
   (excluding audiences from ad set #4 AND existing customers)
   → Same winning ads

4. Video Views & Engagement Lookalike (10%)
   (excluding existing customers only)
   → Same winning ads

SCALING RULES:
• Bump CBO budgets by 10-15% once per day max
• Keep feeding fresh winners from testing framework to fight fatigue
• Do NOT exceed 3-6 ads per ad set initially
• Do NOT use this campaign to test creative — scaling proven winners ONLY

═══ AUDIENCE STRATEGY (2025) ═══

• 2025 = Broad first. Algorithm eats in-platform signals for breakfast.
• Layer in 10% LALs from high-value events (≥ 95th percentile order value, qualified calls)
• Interest stacks only to jump-start new niches — remove ASAP once volume picks up
• NEVER constrain language, demographics, or placements — trust algo + creative
• For LAL audiences, ALWAYS sync to CRM — these are living audiences where you consistently add new customers, remove bad ones. One of the biggest overlooked signals.
• Smaller budgets should use smaller lookalike audiences
• Audience size target: 2 million+ for optimal AI optimization

═══ ADVANTAGE+ SHOPPING/SALES CAMPAIGNS (ASC) ═══

• Great for high-SKU e-commerce
• Terrible for most lead-gen / single-SKU funnels — skip unless you live in Shopify
• Combines prospecting and remarketing into a single automated campaign
• Tests up to 150 creative combinations
• Meta reports 17% lower CPA and 32% higher ROAS on average
• Set existing customer budget cap at 10-20% to prevent algorithm defaulting to remarketing
• No demographic targeting, no placement selection, limited exclusion controls

═══ CREATIVE HEALTH METRICS & BENCHMARKS ═══

Hook Rate (3s video views ÷ impressions): Target >30%, concern <25%, elite 35-45%
Hold Rate (15s views ÷ 3s views): Target >40%, concern <30%
CTR: Healthy 0.90-1.60% cold traffic, 2%+ strong. FB Feed ~1.11%, IG Feed ~1.2%
Creative Lifespan: 2-4 weeks typical, top brands refresh every 10 days
Frequency Fatigue: Concern at 2.5, critical at 3.0+. At 6+ impressions, purchase intent drops ~16%
UGC: 4× higher CTR, 50% lower CPC, 28% higher engagement vs branded content
Reels: 12% higher conversions per dollar, 52% more views, 34% more interactions

═══ KILL / SCALE / ITERATE DECISION FRAMEWORK ═══

KILL IMMEDIATELY:
• Spend ≥ 3× target CPA with 0 conversions → pause now
• CPA 20-30% worse than target after 3+ days
• Frequency > 3.0 AND CTR declining week-over-week
• ROAS below break-even for 3+ consecutive days

SCALE (20% budget increase every 48-72h):
• Stable CPA/ROAS for 7-14 days
• Exited learning phase (50+ conversions/week)
• Frequency < 2.5 with 8-10+ conversions/day
• ROAS 2-3×+ consistently above target

ITERATE (test new hooks/headlines):
• CTR declining 15-20% week-over-week but core concept works
• Hook rate dropping below 25%

NEW CONCEPT NEEDED:
• All creative variations fatigued across ad set
• CVR declining despite fresh hooks/headlines
• Audience saturated (frequency > 3.0 + declining reach)

═══ BUDGET ALLOCATION ═══

Standard split: 70% prospecting / 20% retargeting / 10% testing
Alternative: 60% prospecting / 30% retargeting / 10% testing
Minimum daily budget per ad set: (Target CPA × 50) ÷ 7
Retargeting windows: 1-3d cart abandoners, 3-7d product viewers, 7-30d engaged, 30-180d broader

═══ MEASUREMENT ═══

MER (Marketing Efficiency Ratio) = total revenue ÷ total marketing spend — the "North Star"
Default attribution: 7-day click + 1-day view (but report internally on 1-day click)
Switch to 7-day click only when view-through > 25-30% of total
CAPI: recovers 20-30% of lost conversion data. Target EMQ score >6.0/10
Incrementality: typically 60-70% of reported conversions are truly incremental
Average 2025 benchmarks: ROAS 2.19-2.98× (good: 3-5×), CPA ~$18.68, CPM $10-18 ($20.48 US)

═══ DAILY OPTIMIZATION CADENCE ═══

Daily (5-10 min): Spend pacing, CPA vs target, ROAS trend, delivery status, frequency
Weekly (30-60 min): Creative trends, CTR decline detection, audience saturation, budget elasticity
Monthly (2-4 hrs): MER calculation, first-time vs returning customer split, full creative audit, CAPI health
`;

export default PLAYBOOK_KNOWLEDGE;
