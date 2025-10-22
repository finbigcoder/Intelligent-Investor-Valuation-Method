

import React, { useState } from 'react';
import type { ValuationResult as ValuationResultType, Recommendation, ChecklistItem, GroundingChunk } from '../types';
import PriceChart from './PriceChart';
import FinancialHealthCharts from './FinancialHealthCharts';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, zoomPlugin);

// --- ICONS --- //
const IconStrongBuy: React.FC = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-2.667 5.421a1 1 0 01-.753.542l-5.993 1.034a1 1 0 00-.54 1.748l4.48 4.091a1 1 0 01.282.883l-1.34 5.861a1 1 0 001.48 1.085l5.22-3.003a1 1 0 01.938 0l5.22 3.003a1 1 0 001.48-1.085l-1.34-5.861a1 1 0 01.282-.883l4.48-4.091a1 1 0 00-.54-1.748l-5.993-1.034a1 1 0 01-.753-.542l-2.667-5.421z" /></svg> );
const IconBuy: React.FC = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" /></svg> );
const IconHold: React.FC = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" /></svg> );
const IconSell: React.FC = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" /></svg> );
const IconSpeculative: React.FC = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg> );
const IconRefresh: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5M12 4V2a10 10 0 00-7.525 16.591" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20v2a10 10 0 007.525-16.591" /></svg>);

const recommendationInfo: Record<Recommendation, { style: string; icon: React.ReactNode }> = {
  'Strong Buy': { style: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30', icon: <IconStrongBuy /> },
  'Buy': { style: 'bg-green-500/10 text-green-300 border border-green-500/30', icon: <IconBuy /> },
  'Hold': { style: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30', icon: <IconHold /> },
  'Sell': { style: 'bg-red-500/10 text-red-300 border border-red-500/30', icon: <IconSell /> },
  'Speculative': { style: 'bg-purple-500/10 text-purple-300 border border-purple-500/30', icon: <IconSpeculative /> },
};

// --- SUB-COMPONENTS --- //
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="p-5 rounded-xl bg-black/20 border border-[var(--color-border)] relative z-10">
        <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
        {children}
    </div>
);

const ChecklistItemDisplay: React.FC<{ item: ChecklistItem }> = ({ item }) => (
    <div className="flex items-start space-x-4 p-4 bg-black/20 rounded-lg group transition-colors hover:bg-white/5" title={item.description}>
        <div>
            {item.pass ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
        </div>
        <div>
            <h4 className="font-semibold text-white">{item.name}</h4>
            <p className="text-sm text-[var(--color-text-secondary)]">{item.value}</p>
        </div>
    </div>
);

const TabButton: React.FC<{ name: string; activeTab: string; onClick: (name: string) => void; children: React.ReactNode }> = ({ name, activeTab, onClick, children }) => (
    <button
        onClick={() => onClick(name)}
        className={`px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus:outline-none ${
            activeTab === name
                ? 'border-b-2 border-[var(--color-primary)] text-white'
                : 'border-b-2 border-transparent text-gray-400 hover:text-gray-200'
        }`}
        role="tab"
        aria-selected={activeTab === name}
    >
        {children}
    </button>
);

const KeyMetric: React.FC<{ label: string; value: string; subValue?: string; className?: string }> = ({ label, value, subValue, className = '' }) => (
    <div className={`p-4 rounded-xl bg-black/20 border border-[var(--color-border)] ${className}`}>
        <p className="text-sm text-[var(--color-text-secondary)] font-medium">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{value}</p>
        {subValue && <p className="text-sm text-[var(--color-text-tertiary)]">{subValue}</p>}
    </div>
);

const ScorecardItem: React.FC<{ name: string; value: string; score: number, maxScore: number }> = ({ name, value, score, maxScore }) => {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const getBarColor = (p: number) => {
    if (p >= 80) return 'bg-emerald-500';
    if (p >= 60) return 'bg-green-500';
    if (p >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  }
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-gray-300">{name}</span>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-black/30 border border-white/10">
        <div className={`h-full rounded-full ${getBarColor(percentage)}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};


const DataSources: React.FC<{ chunks?: GroundingChunk[] }> = ({ chunks }) => {
  if (!chunks || chunks.length === 0) return null;
  const validChunks = chunks.filter(chunk => chunk.web && chunk.web.uri && chunk.web.title);
  if (validChunks.length === 0) return null;
  return (
    <Section title="Data Sources">
      <ul className="space-y-2 text-sm">
        {validChunks.map((chunk, index) => (
          <li key={index}>
            <a href={chunk.web!.uri} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-2 -m-2 rounded-lg transition-colors hover:bg-white/5 group" title={chunk.web!.uri}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5 transition-colors group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <span className="break-all text-cyan-400 group-hover:text-cyan-300 group-hover:underline">{chunk.web!.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
};

// --- MAIN COMPONENT --- //
interface ValuationResultProps {
  result: ValuationResultType;
  onRefresh: () => void;
  lastFetchedTimestamp: Date | null;
  isLoading: boolean;
}

const ValuationResult: React.FC<ValuationResultProps> = ({ result, onRefresh, lastFetchedTimestamp, isLoading }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const { stockData, summary, graham, piotroski, valuation } = result;
  
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatTimestamp = (date: Date | null): string => date ? `Data as of ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'graham':
        return <Section title={`Defensive Investor Checklist (${graham.passedCount}/${graham.totalCount} Passed)`}><div className="space-y-3">{graham.checklist.map((item, i) => <ChecklistItemDisplay key={i} item={item} />)}</div></Section>;
      case 'piotroski':
        return <Section title={`Piotroski F-Score (${piotroski.score}/9)`}><div className="space-y-3">{piotroski.checks.map((item, i) => <ChecklistItemDisplay key={i} item={item} />)}</div></Section>;
      case 'valuation':
        return (
          <div className="space-y-6">
             <Section title="Graham Valuation">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <KeyMetric label="Graham Number" value={valuation.grahamNumber > 0 ? formatCurrency(valuation.grahamNumber) : 'N/A'} subValue="Conservative Intrinsic Value" />
                  <KeyMetric label="Margin of Safety" value={isFinite(valuation.grahamMarginOfSafety) ? `${(valuation.grahamMarginOfSafety * 100).toFixed(1)}%` : 'N/A'} subValue={valuation.grahamMarginOfSafety > 0 ? 'Undervalued' : 'Overvalued'} className={valuation.grahamMarginOfSafety > 0 ? 'text-green-400' : 'text-red-400'}/>
                </div>
            </Section>
            <Section title="Net-Net (NCAV) Valuation">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <KeyMetric label="NCAV Per Share" value={valuation.ncavPerShare > 0 ? formatCurrency(valuation.ncavPerShare) : 'N/A'} subValue="Net Current Asset Value" />
                  <KeyMetric label="Price to NCAV Ratio" value={valuation.ncavPerShare > 0 ? `${(stockData.currentPrice / valuation.ncavPerShare).toFixed(2)}x` : 'N/A'} subValue="Target: < 0.67x" />
                </div>
            </Section>
            <Section title="Peter Lynch (PEG) Valuation">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <KeyMetric label="PEG Ratio" value={isFinite(valuation.pegRatio) ? valuation.pegRatio.toFixed(2) : 'N/A'} subValue="Target: < 1.0" />
                  <KeyMetric label="Lynch Fair Value" value={isFinite(valuation.lynchFairValue) ? formatCurrency(valuation.lynchFairValue) : 'N/A'} subValue="Based on growth estimate" />
                </div>
            </Section>
          </div>
        );
      case 'qualitative':
        return (
            <div className="space-y-6">
                <Section title="Economic Moat Analysis"><p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">{stockData.qualitativeAnalysis.economicMoat}</p></Section>
                <Section title="Management Quality Analysis"><p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">{stockData.qualitativeAnalysis.managementQuality}</p></Section>
            </div>
        );
      case 'charts':
          return (
            <div className="space-y-6">
                <div className="h-96 p-4 rounded-xl bg-black/20 border border-[var(--color-border)]">
                    <PriceChart historicalData={stockData.historicalPrices} intrinsicValue={valuation.grahamNumber} />
                </div>
                <FinancialHealthCharts
                  historicalEPS={stockData.historicalEPS}
                  historicalPE={stockData.historicalPE}
                  historicalDebtToEquity={stockData.historicalDebtToEquity}
                />
            </div>
          );
      case 'summary':
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                  <Section title="Valuation Summary"><p className="text-[var(--color-text-secondary)]">{summary.explanation}</p></Section>
                  <Section title="Value Scorecard">
                    <div className="space-y-4">
                      {summary.scorecard.map(item => <ScorecardItem key={item.name} {...item} />)}
                    </div>
                  </Section>
              </div>
              <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                      <KeyMetric label="Current Price" value={formatCurrency(stockData.currentPrice)} />
                      <KeyMetric label="Graham Number" value={valuation.grahamNumber > 0 ? formatCurrency(valuation.grahamNumber) : 'N/A'} subValue="Intrinsic Value" />
                      <KeyMetric label="Piotroski F-Score" value={`${piotroski.score}/9`} subValue={piotroski.score >= 8 ? 'Financially Strong' : 'Needs Review'} />
                      <KeyMetric label="PEG Ratio" value={isFinite(valuation.pegRatio) ? valuation.pegRatio.toFixed(2) : 'N/A'} subValue="Growth at a Price" />
                  </div>
                   <DataSources chunks={stockData.groundingChunks} />
              </div>
          </div>
        );
    }
  };

  return (
    <div className="relative glass-card rounded-xl shadow-2xl glowing-border animate-fade-in-up fintech-bg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-20 transition-opacity duration-300">
            <svg className="animate-spin h-10 w-10 text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="mt-4 text-lg font-semibold text-gray-200">Updating data...</p>
          </div>
        )}
        
        <div className="relative z-10">
            {/* Header */}
            <div className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 w-16 h-16 mr-4 rounded-full bg-[#1C1C1E] border border-[var(--color-border)] flex items-center justify-center"><img src={stockData.logoUrl} alt={`${stockData.companyName} logo`} className="w-full h-full object-contain rounded-full" /></div>
                        <div>
                            <h2 className="text-3xl font-bold text-white">{stockData.companyName}</h2>
                            <p className="text-lg text-[var(--color-text-secondary)] font-mono">{stockData.ticker}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${recommendationInfo[summary.recommendation].style}`}>
                        {recommendationInfo[summary.recommendation].icon}
                        <span>{summary.recommendation}</span>
                    </div>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-baseline gap-2">
                  <p className="text-sm text-[var(--color-text-tertiary)] flex-shrink-0">{formatTimestamp(lastFetchedTimestamp)}</p>
                  <button onClick={onRefresh} disabled={isLoading} className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50" aria-label="Refresh valuation data">
                    <IconRefresh className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /><span>Refresh Data</span>
                  </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--color-border)] px-4 overflow-x-auto">
                <nav className="flex space-x-2" aria-label="Analysis Tabs">
                    <TabButton name="summary" activeTab={activeTab} onClick={setActiveTab}>Summary</TabButton>
                    <TabButton name="graham" activeTab={activeTab} onClick={setActiveTab}>Graham Analysis</TabButton>
                    <TabButton name="piotroski" activeTab={activeTab} onClick={setActiveTab}>Piotroski F-Score</TabButton>
                    <TabButton name="valuation" activeTab={activeTab} onClick={setActiveTab}>Valuation Models</TabButton>
                    <TabButton name="qualitative" activeTab={activeTab} onClick={setActiveTab}>Qualitative Review</TabButton>
                    <TabButton name="charts" activeTab={activeTab} onClick={setActiveTab}>Charts</TabButton>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6 bg-black/10">
              {renderTabContent()}
            </div>
        </div>
    </div>
  );
};

export default ValuationResult;