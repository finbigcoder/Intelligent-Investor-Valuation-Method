
// ─── Shared primitives ────────────────────────────────────────────────────────

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

/** Metrics that require year-over-year comparison */
export interface YearlyFinancialMetric {
  currentYear: number;
  previousYear: number;
}

export type AssetType = 'stock' | 'etf';
export type Recommendation = 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Speculative';

export interface ChecklistItem {
  name: string;
  pass: boolean;
  value: string;
  description: string;
}

export interface AnalysisSummary {
  recommendation: Recommendation;
  explanation: string;
  scorecard: { name: string; value: string; score: number; maxScore: number }[];
}

// ─── Stock-specific types ─────────────────────────────────────────────────────

export interface StockData {
  ticker: string;
  companyName: string;
  logoUrl: string;
  currentPrice: number;
  marketCap: number;

  eps: number; // TTM
  bookValuePerShare: number;
  currentAssets: number;
  currentLiabilities: number;

  roe: number;
  debtToEquity: number;

  longTermDebt: number;
  hasPositiveEarningsLast10Years: boolean;
  hasUninterruptedDividendsLast20Years: boolean;
  eps10YearsAgo: number;
  threeYearAverageEPS: number;

  totalLiabilities: number;
  preferredStockValue: number;

  sharesOutstanding: YearlyFinancialMetric;
  roa: YearlyFinancialMetric;
  operatingCashFlow: number;
  netIncome: number;
  longTermDebtHistory: YearlyFinancialMetric;
  currentRatioHistory: YearlyFinancialMetric;
  grossMargin: YearlyFinancialMetric;
  assetTurnover: YearlyFinancialMetric;

  estimatedEPSGrowthRate: number;

  qualitativeAnalysis: {
    economicMoat: string;
    managementQuality: string;
  };

  historicalPrices: HistoricalPrice[];
  historicalEPS: HistoricalEPS[];
  historicalDebtToEquity: HistoricalDebtToEquity[];
  historicalPE: HistoricalPE[];

  groundingChunks?: GroundingChunk[];
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

export interface StockValuationResult {
  assetType: 'stock';
  stockData: StockData;
  summary: AnalysisSummary;
  graham: GrahamAnalysis;
  piotroski: PiotroskiAnalysis;
  valuation: ValuationAnalysis;
}

// ─── ETF / Index-fund-specific types ─────────────────────────────────────────

export interface ETFHolding {
  name: string;
  weight: number; // as decimal, e.g. 0.07 = 7%
}

export interface SectorAllocation {
  sector: string;
  weight: number; // as decimal
}

export interface AnnualReturn {
  year: number;
  returnPct: number; // as decimal, e.g. 0.12 = 12%
}

export interface ETFData {
  ticker: string;
  name: string;
  currentPrice: number;

  /** Annual management fee as decimal (0.0003 = 0.03%) */
  expenseRatio: number;

  /** Assets Under Management in USD */
  aum: number;

  /** ISO date string: YYYY-MM-DD */
  inceptionDate: string;

  indexTracked: string;
  numberOfHoldings: number;
  dividendYield: number; // as decimal

  /** Standard deviation of returns vs benchmark (annualised, as decimal) */
  trackingError: number;

  top10Holdings: ETFHolding[];
  sectorAllocations: SectorAllocation[];
  annualReturns: AnnualReturn[];

  ytdReturn: number;
  oneYearReturn: number;
  threeYearAnnualizedReturn: number;
  fiveYearAnnualizedReturn: number;
  tenYearAnnualizedReturn: number;

  historicalPrices: HistoricalPrice[];
  groundingChunks?: GroundingChunk[];
}

export interface ETFCostAnalysis {
  checks: ChecklistItem[];
  score: number;   // 0-30
  maxScore: 30;
}

export interface ETFQualityAnalysis {
  checks: ChecklistItem[];
  score: number;   // 0-30
  maxScore: 30;
}

export interface ETFPerformanceAnalysis {
  checks: ChecklistItem[];
  score: number;   // 0-40
  maxScore: 40;
}

export interface ETFValuationResult {
  assetType: 'etf';
  etfData: ETFData;
  cost: ETFCostAnalysis;
  quality: ETFQualityAnalysis;
  performance: ETFPerformanceAnalysis;
  summary: AnalysisSummary;
}

// ─── Union result type ────────────────────────────────────────────────────────

export type AnyValuationResult = StockValuationResult | ETFValuationResult;

// ─── Backwards-compatible alias (old code refers to ValuationResult) ──────────
export type ValuationResult = StockValuationResult;

// ─── History ─────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  ticker: string;
  companyName: string;
  assetType: AssetType;
  valuationDate: string; // ISO string
  recommendation: Recommendation;
  /** Graham Number for stocks; N/A (0) for ETFs */
  intrinsicValue: number;
}
