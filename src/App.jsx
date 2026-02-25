import { useState, useEffect, useCallback, Component } from 'react';
import { fetchFullAccountData, configureGoMarble, getConfig } from './services/gomarble';
import { processAccountData } from './engine/actionQueue';
import { formatCurrency, getDatePresetLabel } from './utils/normalize';
import DEFAULT_THRESHOLDS from './config/thresholds';

import CommandCenter from './tabs/CommandCenter';
import CampaignDive from './tabs/CampaignDive';
import CreativeLab from './tabs/CreativeLab';
import BudgetConsole from './tabs/BudgetConsole';
import Settings from './tabs/Settings';
import ChatAdvisor from './tabs/ChatAdvisor';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="card p-6 m-4 text-center">
          <div className="text-lg font-semibold text-[#ef4444] mb-2">Something went wrong</div>
          <div className="text-xs text-[var(--color-text-muted)] mb-4">{this.state.error.message}</div>
          <button className="btn-primary text-xs px-4 py-2" onClick={() => this.setState({ error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// GoMarble config auto-loads from localStorage (see gomarble.js)
// Only set API key from env if not already saved
const envKey = import.meta.env.VITE_GOMARBLE_API_KEY;
const currentConfig = getConfig();
if (envKey && !currentConfig.apiKey) {
  configureGoMarble({ apiKey: envKey });
}

const TABS = [
  { id: 'command', label: 'Command Center', icon: '⚡' },
  { id: 'campaigns', label: 'Campaigns', icon: '📊' },
  { id: 'creative', label: 'Creative Lab', icon: '🎨' },
  { id: 'budget', label: 'Budget & Scaling', icon: '💰' },
  { id: 'chat', label: 'Chat Advisor', icon: '💬' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

// Load saved thresholds from localStorage
function loadThresholds() {
  try {
    const saved = localStorage.getItem('meta_thresholds');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deep merge with defaults so new fields are always present
      return deepMerge(DEFAULT_THRESHOLDS, parsed);
    }
  } catch {}
  return DEFAULT_THRESHOLDS;
}

function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && defaults[key]) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('command');
  const [thresholds, setThresholds] = useState(loadThresholds);
  const [dateRange, setDateRange] = useState(() => getConfig().datePreset || 'last_30d');
  const [rawData, setRawData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emptyDataWarning, setEmptyDataWarning] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  /**
   * Fetch data from GoMarble. Updates datePreset in config before fetching.
   */
  const fetchData = useCallback(async (overrideDateRange) => {
    const preset = overrideDateRange || dateRange;
    configureGoMarble({ datePreset: preset });
    setLoading(true);
    setError(null);
    setEmptyDataWarning(null);
    try {
      const data = await fetchFullAccountData();
      setRawData(data);
      setLastRefresh(new Date());
      if (data.isEmpty) {
        setEmptyDataWarning(`No data found for "${getDatePresetLabel(preset)}". Try a longer date range (e.g. Last 90 Days).`);
      }
    } catch (err) {
      console.error('Error fetching account data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Process data through decision engine whenever raw data or thresholds change
  useEffect(() => {
    if (rawData) {
      const processed = processAccountData(rawData, thresholds);
      processed.thresholds = thresholds;
      setProcessedData(processed);
    }
  }, [rawData, thresholds]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--color-border)]" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
        <div className="max-w-[1400px] mx-auto px-6 pt-6 pb-0">
          {/* Title Bar */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] tracking-[4px] text-[var(--color-primary)] uppercase mb-1">
                Meta Ads Optimization Engine
              </div>
              <h1 className="text-2xl font-bold gradient-text tracking-tight">
                Daily Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-5">
              {processedData && (
                <>
                  <HeaderStat label="Health" value={processedData.overallHealth} suffix="/100" color={processedData.overallHealth >= 80 ? '#22c55e' : processedData.overallHealth >= 50 ? '#f59e0b' : '#ef4444'} />
                  <div className="w-px h-8 bg-[var(--color-border)]" />
                  <HeaderStat label="ROAS" value={processedData.accountInsights?.roas?.toFixed(2)} suffix="×" />
                  <div className="w-px h-8 bg-[var(--color-border)]" />
                  <HeaderStat label="Spend" value={formatCurrency(processedData.accountInsights?.spend, 'USD', true)} />
                </>
              )}
              <div className="w-px h-8 bg-[var(--color-border)]" />
              <div className="text-right">
                <div className="text-[10px] text-[var(--color-text-muted)]">{getDatePresetLabel(dateRange)}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">
                  {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-0.5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2.5 text-[11px] tracking-wider uppercase transition-all border border-transparent rounded-t-md"
                style={{
                  background: activeTab === tab.id ? 'var(--color-bg-elevated)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  borderColor: activeTab === tab.id ? 'var(--color-border)' : 'transparent',
                  borderBottomColor: activeTab === tab.id ? 'var(--color-bg-elevated)' : 'var(--color-border)',
                }}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Loading State */}
        {loading && !processedData && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-sm text-[var(--color-text-muted)]">Loading account data...</div>
          </div>
        )}

        {/* Empty Data Warning */}
        {emptyDataWarning && (
          <div className="card p-4 mb-4 border-l-[3px] border-l-[#f59e0b]" style={{ background: '#f59e0b11' }}>
            <div className="flex items-center gap-3">
              <span className="text-lg">📭</span>
              <div>
                <div className="text-sm font-medium text-[#f59e0b]">No Data for This Period</div>
                <div className="text-xs text-[var(--color-text-secondary)]">{emptyDataWarning}</div>
              </div>
              <button
                onClick={() => { setDateRange('last_90d'); fetchData('last_90d'); }}
                className="ml-auto px-3 py-1.5 rounded-lg bg-[#f59e0b] text-white text-xs font-medium hover:opacity-90"
              >
                Try Last 90 Days
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !processedData && (
          <div className="card p-8 text-center">
            <div className="text-2xl mb-3">⚠️</div>
            <div className="text-sm text-[#ef4444] mb-2">Error loading data</div>
            <div className="text-xs text-[var(--color-text-muted)] mb-4">{error}</div>
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loaded — Render Active Tab */}
        {processedData && (
          <ErrorBoundary>
            {activeTab === 'command' && <CommandCenter data={processedData} />}
            {activeTab === 'campaigns' && <CampaignDive data={processedData} />}
            {activeTab === 'creative' && <CreativeLab data={processedData} />}
            {activeTab === 'budget' && <BudgetConsole data={processedData} />}
            {activeTab === 'chat' && <ChatAdvisor data={processedData} />}
            {activeTab === 'settings' && (
              <Settings
                thresholds={thresholds}
                onUpdate={setThresholds}
                onRefresh={fetchData}
                dateRange={dateRange}
                onDateRangeChange={(newRange) => {
                  setDateRange(newRange);
                  fetchData(newRange);
                }}
              />
            )}

            {/* Loading overlay for refresh */}
            {loading && (
              <div className="fixed bottom-4 right-4 card px-4 py-2 flex items-center gap-2 shadow-lg z-50">
                <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-[var(--color-text-muted)]">Refreshing...</span>
              </div>
            )}
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

function HeaderStat({ label, value, suffix = '', color }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold tabular-nums" style={{ color: color || 'var(--color-text-primary)' }}>
        {value || '—'}{value && <span className="text-xs opacity-60">{suffix}</span>}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">{label}</div>
    </div>
  );
}
