import React, { useState } from 'react';
import TickerInput from './components/TickerInput';
import ValuationResult from './components/ValuationResult';
import ETFResult from './components/ETFResult';
import LoadingSpinner from './components/LoadingSpinner';
import Disclaimer from './components/Disclaimer';
import HistoryPanel from './components/HistoryPanel';
import InitialState from './components/InitialState';
import { getStockData, getETFData } from './services/aiService';
import { useHistory } from './hooks/useHistory';
import { ApiError, DataProcessingError, InvalidTickerError } from './services/errors';
import { runStockAnalysis } from './lib/analysis';
import { runETFAnalysis } from './lib/etfAnalysis';
import type {
  AssetType,
  AnyValuationResult,
  StockValuationResult,
  ETFValuationResult,
} from './types';

const AppLogo: React.FC = () => (
  <svg
    width="44"
    height="44"
    viewBox="0 0 44 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mr-3"
  >
    <rect width="44" height="44" rx="8" fill="url(#paint0_linear_1_2)" />
    <circle cx="21" cy="19" r="8" stroke="white" strokeWidth="2" />
    <line x1="27" y1="25" x2="32" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <rect x="16" y="19" width="3" height="4" fill="white" />
    <rect x="20" y="16" width="3" height="7" fill="white" />
    <rect x="24" y="18" width="3" height="5" fill="white" />
    <defs>
      <linearGradient
        id="paint0_linear_1_2"
        x1="0"
        y1="0"
        x2="44"
        y2="44"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#22d3ee" />
        <stop offset="1" stopColor="#67e8f9" />
      </linearGradient>
    </defs>
  </svg>
);

const App: React.FC = () => {
  const [result, setResult] = useState<AnyValuationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTicker, setCurrentTicker] = useState<string | null>(null);
  const [currentAssetType, setCurrentAssetType] = useState<AssetType>('stock');
  const [hasSearched, setHasSearched] = useState(false);
  const [lastFetchedTimestamp, setLastFetchedTimestamp] = useState<Date | null>(null);

  const [history, addHistoryEntry, clearHistory] = useHistory();
  const [isHistoryPanelOpen, setHistoryPanelOpen] = useState(false);

  const handleAnalyse = async (ticker: string, assetType: AssetType) => {
    setHasSearched(true);
    setIsLoading(true);
    setError(null);
    if (ticker !== currentTicker || assetType !== currentAssetType) {
      setResult(null);
    }
    setCurrentTicker(ticker);
    setCurrentAssetType(assetType);

    try {
      let analysisResult: AnyValuationResult;

      if (assetType === 'etf') {
        const etfData = await getETFData(ticker);
        analysisResult = runETFAnalysis(etfData);
      } else {
        const stockData = await getStockData(ticker);
        analysisResult = runStockAnalysis(stockData);
      }

      setResult(analysisResult);
      setLastFetchedTimestamp(new Date());
      addHistoryEntry(analysisResult);
    } catch (e) {
      console.error(e);
      setLastFetchedTimestamp(null);
      if (e instanceof InvalidTickerError) {
        setError(
          `Ticker "${e.ticker}" not found. Please enter a valid ticker for NYSE or NASDAQ.`
        );
      } else if (e instanceof ApiError) {
        setError(`Server error: ${e.message}`);
      } else if (e instanceof DataProcessingError) {
        setError('Received unexpected data from the financial service. The data could not be processed.');
      } else if (e instanceof Error) {
        setError(e.message || 'An unexpected error occurred. Please try again.');
      } else {
        setError('An unknown error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFromHistory = (ticker: string, assetType: AssetType) => {
    setHistoryPanelOpen(false);
    setTimeout(() => handleAnalyse(ticker, assetType), 300);
  };

  const handleRefresh = () => {
    if (currentTicker && !isLoading) {
      handleAnalyse(currentTicker, currentAssetType);
    }
  };

  return (
    <div className="min-h-screen text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 md:mb-16">
          <div className="flex justify-between items-center">
            <div className="w-11 flex-shrink-0" />
            <div className="flex items-center mx-2">
              <AppLogo />
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight text-center">
                <span className="text-gradient-primary">Intelligent Investor</span> Valuation
              </h1>
            </div>
            <button
              onClick={() => setHistoryPanelOpen(true)}
              className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-background)] focus:ring-cyan-400 flex-shrink-0"
              aria-label="View valuation history"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
          <p className="text-lg text-gray-400 text-center mt-2">
            Comprehensive analysis for stocks and ETFs based on proven value investing principles.
          </p>
        </header>

        <main>
          <div className="glass-card rounded-xl shadow-2xl p-6 mb-8 glowing-border">
            <TickerInput onValuate={handleAnalyse} isLoading={isLoading} />
          </div>

          {isLoading && !result && <LoadingSpinner ticker={currentTicker} />}

          {error && (
            <div
              className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-4 rounded-lg text-center flex items-center justify-center gap-3 animate-fade-in-up"
              role="alert"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <strong className="font-bold">Analysis Failed</strong>
                <span className="block sm:inline ml-2">{error}</span>
              </div>
            </div>
          )}

          {!isLoading && !error && !result && !hasSearched && <InitialState />}

          {result && result.assetType === 'stock' && (
            <ValuationResult
              result={result as StockValuationResult}
              onRefresh={handleRefresh}
              lastFetchedTimestamp={lastFetchedTimestamp}
              isLoading={isLoading}
            />
          )}

          {result && result.assetType === 'etf' && (
            <ETFResult
              result={result as ETFValuationResult}
              onRefresh={handleRefresh}
              lastFetchedTimestamp={lastFetchedTimestamp}
              isLoading={isLoading}
            />
          )}
        </main>

        <Disclaimer />

        <HistoryPanel
          isOpen={isHistoryPanelOpen}
          onClose={() => setHistoryPanelOpen(false)}
          history={history}
          onSelect={handleSelectFromHistory}
          onClear={clearHistory}
        />
      </div>
    </div>
  );
};

export default App;
