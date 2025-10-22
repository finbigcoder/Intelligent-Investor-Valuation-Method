
export interface HistoricalPrice {
  date: string; // YYYY-MM-DD
  price: number;
}

export interface HistoricalEPS {
  year: number;
  eps: number;
}

export interface HistoricalDebtToEquity {
  year: number;
  ratio: number;
}

export interface HistoricalPE {
  year: number;
  ratio: number;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

// Interface for metrics that require year-over-year comparison
export interface YearlyFinancialMetric {
  currentYear: number;
  previousYear: number;
}


export interface StockData {
  ticker: string;
  companyName: string;
  logoUrl: string;
  currentPrice: number;
  marketCap: number;

  // --- Core Financials ---
  eps: number; // TTM
  bookValuePerShare: number;
  currentAssets: number;
  currentLiabilities: number;
  
  // --- Phase 1: Initial Screening ---
  roe: number; // Return on Equity
  debtToEquity: number;

  // --- Phase 2: Graham's Defensive Criteria ---
  longTermDebt: number;
  hasPositiveEarningsLast10Years: boolean;
  hasUninterruptedDividendsLast20Years: boolean;
  eps10YearsAgo: number;
  threeYearAverageEPS: number;

  // --- Phase 3: Graham's Valuation ---
  totalLiabilities: number;
  preferredStockValue: number;
  
  // --- Phase 4: Piotroski F-Score ---
  sharesOutstanding: YearlyFinancialMetric;
  roa: YearlyFinancialMetric;
  operatingCashFlow: number;
  netIncome: number;
  longTermDebtHistory: YearlyFinancialMetric; // Using different name to avoid conflict
  currentRatioHistory: YearlyFinancialMetric;
  grossMargin: YearlyFinancialMetric;
  assetTurnover: YearlyFinancialMetric;

  // --- Phase 10: Peter Lynch's PEG Ratio ---
  estimatedEPSGrowthRate: number;

  // --- Qualitative Analysis ---
  qualitativeAnalysis: {
    economicMoat: string;
    managementQuality: string;
  };

  // --- Chart Data ---
  historicalPrices: HistoricalPrice[];
  historicalEPS: HistoricalEPS[];
  historicalDebtToEquity: HistoricalDebtToEquity[];
  historicalPE: HistoricalPE[];
  
  // --- Grounding ---
  groundingChunks?: GroundingChunk[];
}


export type Recommendation = 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Speculative';

export interface ChecklistItem {
  name: string;
  pass: boolean;
  value: string;
  description: string;
}

export interface GrahamAnalysis {
  checklist: ChecklistItem[];
  passedCount: number;
  totalCount: number;
}

export interface PiotroskiAnalysis {
  score: number;
  checks: ChecklistItem[];
}

export interface ValuationAnalysis {
  grahamNumber: number;
  grahamMarginOfSafety: number;
  ncavPerShare: number;
  ncavMarginOfSafety: number;
  pegRatio: number;
  lynchFairValue: number;
}

export interface AnalysisSummary {
  recommendation: Recommendation;
  explanation: string;
  scorecard: { name: string; value: string; score: number, maxScore: number }[];
}

export interface ValuationResult {
  stockData: StockData;
  summary: AnalysisSummary;
  graham: GrahamAnalysis;
  piotroski: PiotroskiAnalysis;
  valuation: ValuationAnalysis;
}

export interface HistoryEntry {
  ticker: string;
  companyName: string;
  valuationDate: string; // ISO string
  recommendation: Recommendation;
  intrinsicValue: number; // Storing Graham number for consistency
}
