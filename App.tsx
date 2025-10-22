



import React, { useState } from 'react';
import TickerInput from './components/TickerInput';
import ValuationResult from './components/ValuationResult';
import LoadingSpinner from './components/LoadingSpinner';
import Disclaimer from './components/Disclaimer';
import HistoryPanel from './components/HistoryPanel';
import InitialState from './components/InitialState';
import { getStockData } from './services/geminiService';
import { useHistory } from './hooks/useHistory';
import { ApiError, DataProcessingError, InvalidTickerError } from './services/errors';
import type { StockData, ValuationResult as ValuationResultType, GrahamAnalysis, PiotroskiAnalysis, ValuationAnalysis, AnalysisSummary, Recommendation, ChecklistItem } from './types';

const AppLogo: React.FC = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3">
    <rect width="44" height="44" rx="8" fill="url(#paint0_linear_1_2)"/>
    <circle cx="21" cy="19" r="8" stroke="white" strokeWidth="2"/>
    <line x1="27" y1="25" x2="32" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <rect x="16" y="19" width="3" height="4" fill="white"/>
    <rect x="20" y="16" width="3" height="7" fill="white"/>
    <rect x="24" y="18" width="3" height="5" fill="white"/>
    <defs>
      <linearGradient id="paint0_linear_1_2" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#22d3ee"/>
        <stop offset="1" stopColor="#67e8f9"/>
      </linearGradient>
    </defs>
  </svg>
);


const App: React.FC = () => {
  const [valuationResult, setValuationResult] = useState<ValuationResultType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTicker, setCurrentTicker] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [lastFetchedTimestamp, setLastFetchedTimestamp] = useState<Date | null>(null);

  const [history, addHistoryEntry, clearHistory] = useHistory();
  const [isHistoryPanelOpen, setHistoryPanelOpen] = useState(false);

  const runFullAnalysis = (stockData: StockData): ValuationResultType => {
      const {
        currentPrice, marketCap, currentAssets, currentLiabilities, longTermDebt,
        hasPositiveEarningsLast10Years, hasUninterruptedDividendsLast20Years, eps10YearsAgo,
        threeYearAverageEPS, bookValuePerShare, eps, totalLiabilities, preferredStockValue,
        sharesOutstanding, roa, operatingCashFlow, netIncome, longTermDebtHistory,
        currentRatioHistory, grossMargin, assetTurnover, estimatedEPSGrowthRate,
      } = stockData;

      // --- Phase 2: Graham's Defensive Investor Analysis ---
      const netCurrentAssets = currentAssets - currentLiabilities;
      const peRatio3y = threeYearAverageEPS > 0 ? currentPrice / threeYearAverageEPS : Infinity;
      const pbRatio = bookValuePerShare > 0 ? currentPrice / bookValuePerShare : Infinity;
      
      const grahamChecklist: ChecklistItem[] = [
        { name: '1. Adequate Size', pass: marketCap >= 2_000_000_000, value: `Market Cap: $${(marketCap / 1e9).toFixed(2)}B`, description: 'Market capitalization should be at least $2 billion.' },
        { name: '2. Strong Financials (Current Ratio)', pass: currentRatioHistory.currentYear >= 2.0, value: `Ratio: ${currentRatioHistory.currentYear.toFixed(2)}`, description: 'Current assets should be at least twice current liabilities.' },
        { name: '3. Strong Financials (Debt Load)', pass: longTermDebt <= netCurrentAssets, value: `LT Debt ≤ Net Current Assets`, description: 'Long-term debt should not exceed net current assets (working capital).' },
        { name: '4. Earnings Stability', pass: hasPositiveEarningsLast10Years, value: hasPositiveEarningsLast10Years ? '10/10 Years' : 'Inconsistent', description: 'Positive earnings in each of the past 10 years.' },
        { name: '5. Dividend Record', pass: hasUninterruptedDividendsLast20Years, value: hasUninterruptedDividendsLast20Years ? '20/20 Years' : 'Inconsistent', description: 'Uninterrupted dividend payments for at least 20 years.' },
        { name: '6. Earnings Growth', pass: (eps - eps10YearsAgo) / Math.abs(eps10YearsAgo) >= 0.33, value: `10Y Growth: ${(((eps - eps10YearsAgo) / Math.abs(eps10YearsAgo)) * 100).toFixed(1)}%`, description: 'Minimum 33% EPS growth over the last 10 years.' },
        { name: '7. Moderate Valuation', pass: (peRatio3y <= 15 && pbRatio <= 1.5) || (peRatio3y * pbRatio <= 22.5), value: `P/E: ${peRatio3y.toFixed(2)}, P/B: ${pbRatio.toFixed(2)}`, description: 'P/E (3y avg) ≤ 15, P/B ≤ 1.5, and P/E x P/B ≤ 22.5.' }
      ];
      const graham: GrahamAnalysis = {
        checklist: grahamChecklist,
        passedCount: grahamChecklist.filter(item => item.pass).length,
        totalCount: grahamChecklist.length,
      };

      // --- Phase 4: Piotroski F-Score Analysis ---
      let fScore = 0;
      const piotroskiChecks: ChecklistItem[] = [
        { name: '1. Positive ROA', pass: roa.currentYear > 0, value: `ROA: ${(roa.currentYear * 100).toFixed(2)}%`, description: 'Return on Assets is positive.' },
        { name: '2. Positive Operating Cash Flow', pass: operatingCashFlow > 0, value: `OCF: $${(operatingCashFlow / 1e6).toFixed(2)}M`, description: 'Operating Cash Flow is positive.' },
        { name: '3. Increasing ROA', pass: roa.currentYear > roa.previousYear, value: 'ROA improved', description: 'ROA is higher than the previous year.' },
        { name: '4. Quality of Earnings', pass: operatingCashFlow > netIncome, value: 'OCF > Net Income', description: 'Operating Cash Flow exceeds Net Income.' },
        { name: '5. Decreasing Debt Ratio', pass: longTermDebtHistory.currentYear < longTermDebtHistory.previousYear, value: 'Debt ratio lower', description: 'Long-term debt ratio is lower than previous year.' },
        { name: '6. Increasing Current Ratio', pass: currentRatioHistory.currentYear > currentRatioHistory.previousYear, value: 'Current Ratio improved', description: 'Current Ratio is higher than previous year.' },
        { name: '7. No New Share Issuance', pass: sharesOutstanding.currentYear <= sharesOutstanding.previousYear, value: 'No dilution', description: 'No significant new shares were issued.' },
        { name: '8. Increasing Gross Margin', pass: grossMargin.currentYear > grossMargin.previousYear, value: 'Margin expanded', description: 'Gross Margin is higher than previous year.' },
        { name: '9. Increasing Asset Turnover', pass: assetTurnover.currentYear > assetTurnover.previousYear, value: 'Efficiency improved', description: 'Asset Turnover ratio is higher than previous year.' }
      ];
      piotroskiChecks.forEach(check => { if (check.pass) fScore++; });
      const piotroski: PiotroskiAnalysis = { score: fScore, checks: piotroskiChecks };

      // --- Phase 3 & 7 & 10: Valuation Models ---
      const grahamNumber = (eps > 0 && bookValuePerShare > 0) ? Math.sqrt(22.5 * eps * bookValuePerShare) : 0;
      const ncav = currentAssets - totalLiabilities - preferredStockValue;
      const ncavPerShare = sharesOutstanding.currentYear > 0 ? ncav / sharesOutstanding.currentYear : 0;
      const peRatioTTM = eps > 0 ? currentPrice / eps : Infinity;
      const pegRatio = (isFinite(peRatioTTM) && estimatedEPSGrowthRate > 0) ? peRatioTTM / (estimatedEPSGrowthRate * 100) : Infinity;
      const valuation: ValuationAnalysis = {
        grahamNumber,
        grahamMarginOfSafety: grahamNumber > 0 ? (grahamNumber - currentPrice) / grahamNumber : -Infinity,
        ncavPerShare,
        ncavMarginOfSafety: ncavPerShare > 0 ? (ncavPerShare - currentPrice) / ncavPerShare : -Infinity,
        pegRatio,
        lynchFairValue: eps * (estimatedEPSGrowthRate * 100),
      };

      // --- Final Recommendation Engine ---
      let totalScore = 0;
      totalScore += (graham.passedCount / graham.totalCount) * 40; // Graham score is 40% of total
      totalScore += (piotroski.score / 9) * 40; // Piotroski score is 40% of total
      if (valuation.grahamMarginOfSafety > 0.25) totalScore += 10;
      if (isFinite(valuation.pegRatio) && valuation.pegRatio < 1.0) totalScore += 10;
      
      let recommendation: Recommendation;
      let explanation: string;

      if (eps <= 0) {
        recommendation = 'Speculative';
        explanation = 'The company has negative earnings, making it unsuitable for most value investing criteria. Investment is speculative.';
      } else if (totalScore >= 80) {
        recommendation = 'Strong Buy';
        explanation = `An outstanding candidate, scoring ${totalScore.toFixed(0)}/100. It excels in financial strength, meets Graham's defensive criteria, and appears significantly undervalued.`;
      } else if (totalScore >= 60) {
        recommendation = 'Buy';
        explanation = `A strong candidate, scoring ${totalScore.toFixed(0)}/100. The company shows solid fundamentals and appears attractively valued.`;
      } else if (totalScore >= 40) {
        recommendation = 'Hold';
        explanation = `A mixed picture, scoring ${totalScore.toFixed(0)}/100. The company has some strengths but also weaknesses or a less compelling valuation. A neutral stance is advised.`;
      } else {
        recommendation = 'Sell';
        explanation = `A weak candidate, scoring ${totalScore.toFixed(0)}/100. The company fails to meet key criteria for financial health, stability, or value. Avoid or Sell.`;
      }
      
      const summary: AnalysisSummary = {
        recommendation,
        explanation,
        scorecard: [
          { name: 'Graham Score', value: `${graham.passedCount}/${graham.totalCount}`, score: graham.passedCount, maxScore: graham.totalCount },
          { name: 'Piotroski F-Score', value: `${piotroski.score}/9`, score: piotroski.score, maxScore: 9 },
          { name: 'Valuation', value: valuation.grahamMarginOfSafety > 0 ? 'Undervalued' : 'Overvalued', score: (valuation.grahamMarginOfSafety > 0 ? 1 : 0), maxScore: 1 },
        ],
      };
      
      return { stockData, summary, graham, piotroski, valuation };
  };

  const handleValuation = async (ticker: string) => {
    setHasSearched(true);
    setIsLoading(true);
    setError(null);
    if (ticker.toUpperCase() !== currentTicker) {
        setValuationResult(null);
    }
    setCurrentTicker(ticker.toUpperCase());

    try {
      const stockData = await getStockData(ticker);
      const resultData = runFullAnalysis(stockData);
      
      setValuationResult(resultData);
      setLastFetchedTimestamp(new Date());
      // FIX: Pass the entire resultData object to addHistoryEntry, as the hook is responsible for creating the HistoryEntry.
      addHistoryEntry(resultData);

    } catch (e) {
      console.error(e);
      setLastFetchedTimestamp(null);
      if (e instanceof InvalidTickerError) {
        setError(`Ticker "${e.ticker}" not found. Please enter a valid stock ticker for NYSE or NASDAQ.`);
      } else if (e instanceof ApiError) {
        setError('Could not connect to the financial data service. Please check your network connection and try again later.');
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
  
  const handleSelectFromHistory = (ticker: string) => {
    setHistoryPanelOpen(false);
    setTimeout(() => {
        handleValuation(ticker);
    }, 300);
  };
  
  const handleRefresh = () => {
    if (currentTicker && !isLoading) {
      handleValuation(currentTicker);
    }
  };


  return (
    <div className="min-h-screen text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 md:mb-16">
           <div className="flex justify-between items-center">
              {/* Left spacer to balance the history button for true centering of the title */}
              <div className="w-11 flex-shrink-0"></div> 
              
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
          </div>
          <p className="text-lg text-gray-400 text-center mt-2">
            A comprehensive analysis based on proven value investing principles.
          </p>
        </header>

        <main>
          <div className="glass-card rounded-xl shadow-2xl p-6 mb-8 glowing-border">
            <TickerInput onValuate={handleValuation} isLoading={isLoading} />
          </div>

          {isLoading && !valuationResult && <LoadingSpinner ticker={currentTicker} />}
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-4 rounded-lg text-center flex items-center justify-center gap-3 animate-fade-in-up" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <strong className="font-bold">Valuation Failed</strong>
                <span className="block sm:inline ml-2">{error}</span>
              </div>
            </div>
          )}

          {!isLoading && !error && !valuationResult && !hasSearched && <InitialState />}
          
          {valuationResult && (
            <ValuationResult 
              result={valuationResult} 
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