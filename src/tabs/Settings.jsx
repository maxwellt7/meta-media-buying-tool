import { useState } from 'react';
import { formatCurrency } from '../utils/normalize';
import { minDailyBudget } from '../utils/metrics';
import { configureClaudeAPI, hasClaudeKey } from '../services/claude';
import { configureGoMarble, getConfig } from '../services/gomarble';

export default function Settings({ thresholds, onUpdate, onRefresh, dateRange, onDateRangeChange }) {
  const [claudeKey, setClaudeKey] = useState('');
  const [claudeSaved, setClaudeSaved] = useState(hasClaudeKey());
  const [refreshing, setRefreshing] = useState(false);
  const [goMarbleConfig] = useState(() => getConfig());
  const [gmApiKey, setGmApiKey] = useState(goMarbleConfig.apiKey || '');
  const [gmAccountId, setGmAccountId] = useState(goMarbleConfig.accountId || '');
  const [gmMode, setGmMode] = useState(goMarbleConfig.mode || 'mock');
  const [gmSaved, setGmSaved] = useState(false);
  const [savedSections, setSavedSections] = useState({});
  const profile = thresholds.profile || {};

  function handleProfileChange(field, value) {
    onUpdate({
      ...thresholds,
      profile: { ...profile, [field]: value },
    });
  }

  function handleThresholdChange(section, field, value) {
    onUpdate({
      ...thresholds,
      [section]: { ...thresholds[section], [field]: value },
    });
  }

  function saveThresholds(sectionName) {
    try {
      localStorage.setItem('meta_thresholds', JSON.stringify(thresholds));
    } catch {}
    setSavedSections(prev => ({ ...prev, [sectionName]: true }));
    setTimeout(() => setSavedSections(prev => ({ ...prev, [sectionName]: false })), 2500);
  }

  const minBudget = minDailyBudget(profile.targetCPA || 30);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* GoMarble Connection */}
      <div className="card p-6" style={{ borderLeft: '3px solid var(--color-accent)' }}>
        <h3 className="text-sm font-semibold tracking-wider text-[var(--color-accent)] uppercase mb-4">
          GoMarble MCP Connection
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingField
            label="Data Source"
            type="select"
            value={gmMode}
            options={[
              { label: 'Mock Data (Demo)', value: 'mock' },
              { label: 'GoMarble MCP (Live)', value: 'direct' },
            ]}
            onChange={v => setGmMode(v)}
          />
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">GoMarble API Key</label>
            <input
              type="password"
              value={gmApiKey}
              onChange={e => setGmApiKey(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Ad Account ID</label>
            <input
              type="text"
              value={gmAccountId}
              onChange={e => setGmAccountId(e.target.value)}
              placeholder="act_123456789"
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                configureGoMarble({ mode: gmMode, apiKey: gmApiKey, accountId: gmAccountId || null });
                setGmSaved(true);
                setTimeout(() => setGmSaved(false), 2000);
                onRefresh();
              }}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
              {gmSaved ? '✅ Saved & Refreshing' : '💾 Save & Connect'}
            </button>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-lg bg-[#0ea5e911] border border-[#0ea5e933]">
          <div className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            <strong className="text-[var(--color-accent)]">Status:</strong>{' '}
            {gmMode === 'mock' ? (
              <span>Using demo data. Switch to "GoMarble MCP (Live)" to connect to your real Meta ad account.</span>
            ) : gmApiKey ? (
              <span className="text-[#22c55e]">Configured — API key set. Click "Save & Connect" to fetch live data.</span>
            ) : (
              <span className="text-[#f59e0b]">API key required. Enter your GoMarble key above.</span>
            )}
          </div>
        </div>
      </div>

      {/* Client Profile */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold tracking-wider text-[var(--color-primary)] uppercase mb-4">
          Client Profile
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingField
            label="Business Type"
            type="select"
            value={profile.businessType}
            options={[
              { label: 'Ecommerce', value: 'ecommerce' },
              { label: 'Lead Generation', value: 'leadgen' },
            ]}
            onChange={v => handleProfileChange('businessType', v)}
          />
          <SettingField
            label="Target CPA"
            type="currency"
            value={profile.targetCPA}
            onChange={v => handleProfileChange('targetCPA', Number(v))}
            hint={`Min daily budget per ad set: ${formatCurrency(minBudget)}`}
          />
          <SettingField
            label="Target ROAS"
            type="number"
            value={profile.targetROAS}
            step="0.1"
            onChange={v => handleProfileChange('targetROAS', Number(v))}
          />
          <SettingField
            label="Break-Even ROAS"
            type="number"
            value={profile.breakEvenROAS}
            step="0.1"
            onChange={v => handleProfileChange('breakEvenROAS', Number(v))}
          />
          <SettingField
            label="Monthly Budget"
            type="currency"
            value={profile.monthlyBudget}
            onChange={v => handleProfileChange('monthlyBudget', Number(v))}
          />
          <SettingField
            label="Currency"
            type="select"
            value={profile.currency}
            options={[
              { label: 'USD', value: 'USD' },
              { label: 'EUR', value: 'EUR' },
              { label: 'GBP', value: 'GBP' },
              { label: 'CAD', value: 'CAD' },
              { label: 'AUD', value: 'AUD' },
            ]}
            onChange={v => handleProfileChange('currency', v)}
          />
        </div>
        <SaveButton saved={savedSections.profile} onClick={() => saveThresholds('profile')} />
      </div>

      {/* Kill Thresholds */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold tracking-wider text-[#ef4444] uppercase mb-4">
          Kill Signal Thresholds
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingField
            label="Zero-conversion spend multiplier"
            type="number"
            value={thresholds.kill?.spendMultiplierZeroConversions}
            step="0.5"
            onChange={v => handleThresholdChange('kill', 'spendMultiplierZeroConversions', Number(v))}
            hint={`Kill at: ${formatCurrency((profile.targetCPA || 30) * (thresholds.kill?.spendMultiplierZeroConversions || 3))} spend with 0 conversions`}
          />
          <SettingField
            label="CPA overage threshold (%)"
            type="number"
            value={(thresholds.kill?.cpaWorsePercent || 0.25) * 100}
            step="5"
            onChange={v => handleThresholdChange('kill', 'cpaWorsePercent', Number(v) / 100)}
            hint={`Kill at: CPA > ${formatCurrency((profile.targetCPA || 30) * (1 + (thresholds.kill?.cpaWorsePercent || 0.25)))}`}
          />
          <SettingField
            label="Frequency kill threshold"
            type="number"
            value={thresholds.kill?.frequencyKillThreshold}
            step="0.5"
            onChange={v => handleThresholdChange('kill', 'frequencyKillThreshold', Number(v))}
          />
          <SettingField
            label="ROAS below break-even days"
            type="number"
            value={thresholds.kill?.roasBelowBreakevenDays}
            step="1"
            onChange={v => handleThresholdChange('kill', 'roasBelowBreakevenDays', Number(v))}
          />
        </div>
        <SaveButton saved={savedSections.kill} onClick={() => saveThresholds('kill')} />
      </div>

      {/* Scale Thresholds */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold tracking-wider text-[#22c55e] uppercase mb-4">
          Scale Signal Thresholds
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingField
            label="Stability days required"
            type="number"
            value={thresholds.scale?.stabilityDaysRequired}
            step="1"
            onChange={v => handleThresholdChange('scale', 'stabilityDaysRequired', Number(v))}
          />
          <SettingField
            label="Max budget increase (%)"
            type="number"
            value={(thresholds.scale?.maxBudgetIncreasePercent || 0.20) * 100}
            step="5"
            onChange={v => handleThresholdChange('scale', 'maxBudgetIncreasePercent', Number(v) / 100)}
          />
          <SettingField
            label="Max scale frequency"
            type="number"
            value={thresholds.scale?.frequencyScaleMax}
            step="0.1"
            onChange={v => handleThresholdChange('scale', 'frequencyScaleMax', Number(v))}
          />
          <SettingField
            label="Min daily conversions"
            type="number"
            value={thresholds.scale?.minDailyConversions}
            step="1"
            onChange={v => handleThresholdChange('scale', 'minDailyConversions', Number(v))}
          />
        </div>
        <SaveButton saved={savedSections.scale} onClick={() => saveThresholds('scale')} />
      </div>

      {/* Iterate / New Concept Thresholds */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold tracking-wider text-[#f59e0b] uppercase mb-4">
          Iterate &amp; New Concept Thresholds
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingField
            label="CTR decline WoW - iterate (%)"
            type="number"
            value={(thresholds.iterate?.ctrDeclineWoWPercent || 0.15) * 100}
            step="5"
            onChange={v => handleThresholdChange('iterate', 'ctrDeclineWoWPercent', Number(v) / 100)}
          />
          <SettingField
            label="CTR decline WoW - critical (%)"
            type="number"
            value={(thresholds.iterate?.ctrDeclineWoWCritical || 0.20) * 100}
            step="5"
            onChange={v => handleThresholdChange('iterate', 'ctrDeclineWoWCritical', Number(v) / 100)}
          />
          <SettingField
            label="Hook rate iterate threshold (%)"
            type="number"
            value={(thresholds.iterate?.hookRateIterateThreshold || 0.25) * 100}
            step="5"
            onChange={v => handleThresholdChange('iterate', 'hookRateIterateThreshold', Number(v) / 100)}
          />
          <SettingField
            label="Audience saturation frequency"
            type="number"
            value={thresholds.newConcept?.audienceSaturatedFrequency}
            step="0.5"
            onChange={v => handleThresholdChange('newConcept', 'audienceSaturatedFrequency', Number(v))}
          />
        </div>
        <SaveButton saved={savedSections.iterate} onClick={() => saveThresholds('iterate')} />
      </div>

      {/* AI & Data Controls */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold tracking-wider text-[var(--color-accent)] uppercase mb-4">
          AI &amp; Data Controls
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingField
            label="Analysis Date Range"
            type="select"
            value={dateRange}
            options={[
              { label: 'Last 7 Days', value: 'last_7d' },
              { label: 'Last 14 Days', value: 'last_14d' },
              { label: 'Last 30 Days', value: 'last_30d' },
              { label: 'Last 90 Days', value: 'last_90d' },
            ]}
            onChange={onDateRangeChange}
          />
          <div>
            <div className="text-xs text-[var(--color-text-muted)] mb-2">Refresh Data</div>
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                Promise.resolve(onRefresh()).finally(() => {
                  setTimeout(() => setRefreshing(false), 2000);
                });
              }}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg text-white text-xs font-medium transition-all cursor-pointer disabled:opacity-60"
              style={{ background: refreshing ? '#22c55e' : 'var(--color-accent)' }}
            >
              {refreshing ? '✅ Refreshing...' : '🔄 Refresh Now'}
            </button>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">
              Anthropic API Key (for AI Briefings — optional)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={claudeKey}
                onChange={e => { setClaudeKey(e.target.value); setClaudeSaved(false); }}
                placeholder={hasClaudeKey() ? '••••••••••••••• (key saved)' : 'sk-ant-...'}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <button
                type="button"
                onClick={() => {
                  if (!claudeKey.trim()) return;
                  configureClaudeAPI(claudeKey.trim());
                  setClaudeSaved(true);
                  setTimeout(() => setClaudeSaved(false), 3000);
                }}
                disabled={!claudeKey.trim()}
                className="px-4 py-2 rounded-lg text-white text-xs font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: claudeSaved ? '#22c55e' : 'var(--color-primary)' }}
              >
                {claudeSaved ? '✅ Saved!' : '💾 Save Key'}
              </button>
            </div>
            <div className="text-[10px] mt-1" style={{ color: claudeSaved ? '#22c55e' : 'var(--color-text-muted)' }}>
              {claudeSaved
                ? 'API key saved successfully. AI briefings will now use Claude.'
                : 'Without an API key, AI briefings use local rule-based generation. With a key, Claude generates executive-style briefings.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveButton({ saved, onClick }) {
  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
      <button
        type="button"
        onClick={onClick}
        className="px-5 py-2 rounded-lg text-white text-xs font-medium transition-all cursor-pointer"
        style={{ background: saved ? '#22c55e' : 'var(--color-primary)' }}
      >
        {saved ? '✅ Saved!' : '💾 Save Changes'}
      </button>
      {saved && (
        <span className="text-[11px] text-[#22c55e]">Settings saved and will persist across refreshes.</span>
      )}
    </div>
  );
}

function SettingField({ label, type, value, onChange, options, hint, step }) {
  return (
    <div>
      <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">{label}</label>
      {type === 'select' ? (
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] transition-colors"
        >
          {(options || []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          value={value || ''}
          step={step || '1'}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] transition-colors tabular-nums"
        />
      )}
      {hint && <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{hint}</div>}
    </div>
  );
}
