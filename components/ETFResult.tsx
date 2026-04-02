import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import type { ETFValuationResult, ChecklistItem, Recommendation } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
);

// ─── Sub-components ───────────────────────────────────────────────────────────

const RECOMMENDATION_STYLES: Record<
  Recommendation,
  { bg: string; border: string; text: string; badge: string }
> = {
  'Strong Buy': {
    bg: 'bg-emerald-900/40',
    border: 'border-emerald-500',
    text: 'text-emerald-300',
    badge: 'bg-emerald-500',
  },
  Buy: {
    bg: 'bg-cyan-900/40',
    border: 'border-cyan-500',
    text: 'text-cyan-300',
    badge: 'bg-cyan-500',
  },
  Hold: {
    bg: 'bg-yellow-900/40',
    border: 'border-yellow-500',
    text: 'text-yellow-300',
    badge: 'bg-yellow-500',
  },
  Sell: {
    bg: 'bg-red-900/40',
    border: 'border-red-500',
    text: 'text-red-300',
    badge: 'bg-red-500',
  },
  Speculative: {
    bg: 'bg-orange-900/40',
    border: 'border-orange-500',
    text: 'text-orange-300',
    badge: 'bg-orange-500',
  },
};

const CheckRow: React.FC<{ item: ChecklistItem }> = ({ item }) => (
  <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
    <span className={`mt-0.5 flex-shrink-0 text-lg ${item.pass ? 'text-emerald-400' : 'text-red-400'}`}>
      {item.pass ? '✓' : '✗'}
    </span>
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold text-gray-200">{item.name}</span>
        <span className="text-xs text-gray-400 truncate">{item.value}</span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
    </div>
  </div>
);

const ScoreBar: React.FC<{ label: string; score: number; maxScore: number; colorClass: string }> = ({
  label,
  score,
  maxScore,
  colorClass,
}) => {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm font-bold text-white">
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ─── Price chart ──────────────────────────────────────────────────────────────

const ETFPriceChart: React.FC<{ result: ETFValuationResult }> = ({ result }) => {
  const { etfData } = result;
  const prices = etfData.historicalPrices;
  if (!prices || prices.length === 0) return null;

  const chartData = {
    labels: prices.map((p) => p.date),
    datasets: [
      {
        label: etfData.ticker,
        data: prices.map((p) => p.price),
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34,211,238,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx: { parsed: { y: number } }) =>
            ` $${ctx.parsed.y.toFixed(2)}`,
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: { unit: 'month' as const },
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#6b7280', maxTicksLimit: 6 },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#6b7280',
          callback: (v: number | string) => `$${Number(v).toFixed(0)}`,
        },
      },
    },
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-3">Price History</h3>
      <div className="h-56 glass-card rounded-lg p-3">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

// ─── Holdings / Sector breakdown ──────────────────────────────────────────────

const HoldingsTable: React.FC<{ result: ETFValuationResult }> = ({ result }) => {
  const { etfData } = result;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {/* Top 10 holdings */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-base font-semibold text-gray-200 mb-3">Top 10 Holdings</h3>
        <div className="space-y-2">
          {etfData.top10Holdings.map((h) => (
            <div key={h.name} className="flex justify-between items-center">
              <span className="text-sm text-gray-300 truncate mr-2">{h.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${Math.min(h.weight * 100 * 5, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">
                  {(h.weight * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sector allocations */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-base font-semibold text-gray-200 mb-3">Sector Allocation</h3>
        <div className="space-y-2">
          {etfData.sectorAllocations.slice(0, 10).map((s) => (
            <div key={s.sector} className="flex justify-between items-center">
              <span className="text-sm text-gray-300 truncate mr-2">{s.sector}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${Math.min(s.weight * 100 * 3.3, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">
                  {(s.weight * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface ETFResultProps {
  result: ETFValuationResult;
  onRefresh: () => void;
  lastFetchedTimestamp: Date | null;
  isLoading: boolean;
}

const ETFResult: React.FC<ETFResultProps> = ({
  result,
  onRefresh,
  lastFetchedTimestamp,
  isLoading,
}) => {
  const { etfData, cost, quality, performance, summary } = result;
  const [activeTab, setActiveTab] = useState<'cost' | 'quality' | 'performance'>('cost');
  const rec = summary.recommendation;
  const styles = RECOMMENDATION_STYLES[rec];
  const totalScore = cost.score + quality.score + performance.score;

  const tabs = [
    { id: 'cost' as const, label: `Cost (${cost.score}/30)` },
    { id: 'quality' as const, label: `Quality (${quality.score}/30)` },
    { id: 'performance' as const, label: `Performance (${performance.score}/40)` },
  ];

  const activeChecks =
    activeTab === 'cost'
      ? cost.checks
      : activeTab === 'quality'
      ? quality.checks
      : performance.checks;

  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header card */}
      <div className={`glass-card rounded-xl p-6 border ${styles.border} ${styles.bg}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-black ${styles.badge}`}>
                {rec}
              </span>
              <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
                ETF / Index Fund
              </span>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-extrabold ${styles.text}`}>
              {etfData.ticker}
            </h2>
            <p className="text-gray-400 text-sm mt-1">{etfData.name}</p>
            <p className="text-gray-400 text-sm">
              Tracks: <span className="text-gray-300">{etfData.indexTracked}</span>
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-bold text-white">
              ${etfData.currentPrice.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {lastFetchedTimestamp
                ? `As of ${lastFetchedTimestamp.toLocaleTimeString()}`
                : ''}
            </div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="mt-2 text-xs text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-40 flex items-center gap-1 ml-auto"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <p className="text-gray-300 text-sm mt-4 leading-relaxed border-t border-white/10 pt-4">
          {summary.explanation}
        </p>
      </div>

      {/* Score overview */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-200">Overall Score</h3>
          <span className={`text-3xl font-extrabold ${styles.text}`}>{totalScore}/100</span>
        </div>
        <ScoreBar label="Cost" score={cost.score} maxScore={cost.maxScore} colorClass="bg-emerald-500" />
        <ScoreBar label="Quality / Scale" score={quality.score} maxScore={quality.maxScore} colorClass="bg-cyan-500" />
        <ScoreBar label="Performance" score={performance.score} maxScore={performance.maxScore} colorClass="bg-indigo-500" />
      </div>

      {/* Key metrics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Expense Ratio', value: `${(etfData.expenseRatio * 100).toFixed(2)}%` },
          { label: 'AUM', value: etfData.aum >= 1e9 ? `$${(etfData.aum / 1e9).toFixed(0)}B` : `$${(etfData.aum / 1e6).toFixed(0)}M` },
          { label: 'Holdings', value: etfData.numberOfHoldings.toLocaleString() },
          { label: '5Y Return', value: fmt(etfData.fiveYearAnnualizedReturn) + ' p.a.' },
          { label: '1Y Return', value: fmt(etfData.oneYearReturn) },
          { label: '3Y Return', value: fmt(etfData.threeYearAnnualizedReturn) + ' p.a.' },
          { label: '10Y Return', value: etfData.tenYearAnnualizedReturn ? fmt(etfData.tenYearAnnualizedReturn) + ' p.a.' : 'N/A' },
          { label: 'Div. Yield', value: `${(etfData.dividendYield * 100).toFixed(2)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-sm font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Checklist tabs */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-wrap gap-2 mb-5 border-b border-white/10 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm px-4 py-1.5 rounded-full transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-black font-bold'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="divide-y divide-white/5">
          {activeChecks.map((item) => (
            <CheckRow key={item.name} item={item} />
          ))}
        </div>
      </div>

      {/* Price chart */}
      <ETFPriceChart result={result} />

      {/* Holdings breakdown */}
      <HoldingsTable result={result} />
    </div>
  );
};

export default ETFResult;
