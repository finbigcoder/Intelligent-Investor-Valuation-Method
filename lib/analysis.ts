/**
 * Pure stock analysis functions — no React, no side effects.
 * All functions are deterministic and fully unit-testable.
 */

import type {
  StockData,
  StockValuationResult,
  GrahamAnalysis,
  PiotroskiAnalysis,
  ValuationAnalysis,
  AnalysisSummary,
  ChecklistItem,
  Recommendation,
} from '../types';

// ─── Graham Defensive Investor Analysis ──────────────────────────────────────

export function buildGrahamAnalysis(data: StockData): GrahamAnalysis {
  const {
    marketCap,
    currentAssets,
    currentLiabilities,
    longTermDebt,
    hasPositiveEarningsLast10Years,
    hasUninterruptedDividendsLast20Years,
    eps,
    eps10YearsAgo,
    threeYearAverageEPS,
    currentPrice,
    bookValuePerShare,
    currentRatioHistory,
  } = data;

  const netCurrentAssets = currentAssets - currentLiabilities;
  const peRatio3y =
    threeYearAverageEPS > 0 ? currentPrice / threeYearAverageEPS : Infinity;
  const pbRatio =
    bookValuePerShare > 0 ? currentPrice / bookValuePerShare : Infinity;

  const eps10yGrowth =
    eps10YearsAgo !== 0
      ? (eps - eps10YearsAgo) / Math.abs(eps10YearsAgo)
      : eps > 0
      ? Infinity
      : -Infinity;

  const checklist: ChecklistItem[] = [
    {
      name: '1. Adequate Size',
      pass: marketCap >= 2_000_000_000,
      value: `Market Cap: $${(marketCap / 1e9).toFixed(2)}B`,
      description:
        'Market capitalisation should be at least $2 billion for a defensive investor.',
    },
    {
      name: '2. Strong Financials (Current Ratio)',
      pass: currentRatioHistory.currentYear >= 2.0,
      value: `Ratio: ${currentRatioHistory.currentYear.toFixed(2)}`,
      description:
        'Current assets should be at least twice current liabilities (Current Ratio ≥ 2.0).',
    },
    {
      name: '3. Strong Financials (Debt Load)',
      pass: longTermDebt <= netCurrentAssets,
      value: `LT Debt ≤ Net Current Assets ($${(netCurrentAssets / 1e9).toFixed(2)}B)`,
      description:
        'Long-term debt should not exceed net current assets (working capital).',
    },
    {
      name: '4. Earnings Stability',
      pass: hasPositiveEarningsLast10Years,
      value: hasPositiveEarningsLast10Years ? '10/10 Years positive' : 'Inconsistent',
      description: 'Positive earnings in each of the past 10 years.',
    },
    {
      name: '5. Dividend Record',
      pass: hasUninterruptedDividendsLast20Years,
      value: hasUninterruptedDividendsLast20Years
        ? '20/20 Years uninterrupted'
        : 'Inconsistent',
      description: 'Uninterrupted dividend payments for at least 20 years.',
    },
    {
      name: '6. Earnings Growth',
      pass: eps10yGrowth >= 0.33,
      value: `10Y EPS Growth: ${
        isFinite(eps10yGrowth) ? (eps10yGrowth * 100).toFixed(1) + '%' : 'N/A'
      }`,
      description: 'At least 33% cumulative EPS growth over the past 10 years.',
    },
    {
      name: '7. Moderate Valuation',
      pass:
        (peRatio3y <= 15 && pbRatio <= 1.5) ||
        (isFinite(peRatio3y) && isFinite(pbRatio) && peRatio3y * pbRatio <= 22.5),
      value: `P/E (3y): ${
        isFinite(peRatio3y) ? peRatio3y.toFixed(2) : '∞'
      }, P/B: ${isFinite(pbRatio) ? pbRatio.toFixed(2) : '∞'}`,
      description:
        'P/E (3yr avg) ≤ 15 AND P/B ≤ 1.5, OR their product ≤ 22.5.',
    },
  ];

  return {
    checklist,
    passedCount: checklist.filter((i) => i.pass).length,
    totalCount: checklist.length,
  };
}

// ─── Piotroski F-Score ────────────────────────────────────────────────────────

export function buildPiotroskiAnalysis(data: StockData): PiotroskiAnalysis {
  const {
    roa,
    operatingCashFlow,
    netIncome,
    longTermDebtHistory,
    currentRatioHistory,
    sharesOutstanding,
    grossMargin,
    assetTurnover,
  } = data;

  const checks: ChecklistItem[] = [
    {
      name: '1. Positive ROA',
      pass: roa.currentYear > 0,
      value: `ROA: ${(roa.currentYear * 100).toFixed(2)}%`,
      description: 'Return on Assets is positive (profitable business).',
    },
    {
      name: '2. Positive Operating Cash Flow',
      pass: operatingCashFlow > 0,
      value: `OCF: $${(operatingCashFlow / 1e6).toFixed(1)}M`,
      description: 'Operating Cash Flow is positive.',
    },
    {
      name: '3. Increasing ROA',
      pass: roa.currentYear > roa.previousYear,
      value: `ROA improved YoY`,
      description: 'ROA is higher than the previous year.',
    },
    {
      name: '4. Quality of Earnings (Accruals)',
      pass: operatingCashFlow > netIncome,
      value: `OCF > Net Income`,
      description:
        'Operating Cash Flow exceeds Net Income — earnings are backed by cash.',
    },
    {
      name: '5. Decreasing Long-Term Debt Ratio',
      pass: longTermDebtHistory.currentYear < longTermDebtHistory.previousYear,
      value: 'Debt ratio lower YoY',
      description: 'Long-term debt ratio is lower than the previous year.',
    },
    {
      name: '6. Increasing Current Ratio',
      pass: currentRatioHistory.currentYear > currentRatioHistory.previousYear,
      value: 'Liquidity improved YoY',
      description: 'Current Ratio is higher than the previous year.',
    },
    {
      name: '7. No New Share Issuance',
      pass: sharesOutstanding.currentYear <= sharesOutstanding.previousYear,
      value: 'No shareholder dilution',
      description:
        'No significant new shares were issued (no dilution of existing shareholders).',
    },
    {
      name: '8. Increasing Gross Margin',
      pass: grossMargin.currentYear > grossMargin.previousYear,
      value: 'Gross margin expanded YoY',
      description:
        'Gross Margin is higher than the previous year — improving profitability.',
    },
    {
      name: '9. Increasing Asset Turnover',
      pass: assetTurnover.currentYear > assetTurnover.previousYear,
      value: 'Asset efficiency improved YoY',
      description:
        'Asset Turnover ratio is higher than the previous year — better use of assets.',
    },
  ];

  const score = checks.filter((c) => c.pass).length;
  return { score, checks };
}

// ─── Valuation Models ─────────────────────────────────────────────────────────

export function buildValuationAnalysis(data: StockData): ValuationAnalysis {
  const {
    eps,
    bookValuePerShare,
    currentAssets,
    totalLiabilities,
    preferredStockValue,
    sharesOutstanding,
    currentPrice,
    estimatedEPSGrowthRate,
  } = data;

  // Graham Number: √(22.5 × EPS × Book Value per Share)
  const grahamNumber =
    eps > 0 && bookValuePerShare > 0
      ? Math.sqrt(22.5 * eps * bookValuePerShare)
      : 0;

  const grahamMarginOfSafety =
    grahamNumber > 0 ? (grahamNumber - currentPrice) / grahamNumber : -Infinity;

  // Net-Net (NCAV) working capital value per share
  const ncav = currentAssets - totalLiabilities - preferredStockValue;
  const ncavPerShare =
    sharesOutstanding.currentYear > 0
      ? ncav / sharesOutstanding.currentYear
      : 0;

  const ncavMarginOfSafety =
    ncavPerShare > 0 ? (ncavPerShare - currentPrice) / ncavPerShare : -Infinity;

  // PEG Ratio: P/E ÷ (expected growth %)
  const peRatioTTM = eps > 0 ? currentPrice / eps : Infinity;
  const pegRatio =
    isFinite(peRatioTTM) && estimatedEPSGrowthRate > 0
      ? peRatioTTM / (estimatedEPSGrowthRate * 100)
      : Infinity;

  // Lynch Fair Value: EPS × (expected growth %)
  const lynchFairValue = eps * (estimatedEPSGrowthRate * 100);

  return {
    grahamNumber,
    grahamMarginOfSafety,
    ncavPerShare,
    ncavMarginOfSafety,
    pegRatio,
    lynchFairValue,
  };
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

/**
 * Combines Graham (40%), Piotroski (40%) and Valuation bonuses (20%) into a
 * 0-100 score and maps it to a recommendation.
 */
export function buildSummary(
  data: StockData,
  graham: GrahamAnalysis,
  piotroski: PiotroskiAnalysis,
  valuation: ValuationAnalysis
): AnalysisSummary {
  const { eps } = data;

  let totalScore = 0;
  totalScore += (graham.passedCount / graham.totalCount) * 40;
  totalScore += (piotroski.score / 9) * 40;
  if (valuation.grahamMarginOfSafety > 0.25) totalScore += 10;
  if (isFinite(valuation.pegRatio) && valuation.pegRatio < 1.0) totalScore += 10;

  let recommendation: Recommendation;
  let explanation: string;

  if (eps <= 0) {
    recommendation = 'Speculative';
    explanation =
      'The company has negative or zero earnings, making it unsuitable for most value investing criteria. Any investment is speculative.';
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
    explanation = `A weak candidate, scoring ${totalScore.toFixed(0)}/100. The company fails to meet key criteria for financial health, stability, or value. Avoid or sell.`;
  }

  const scorecard = [
    {
      name: 'Graham Score',
      value: `${graham.passedCount}/${graham.totalCount}`,
      score: graham.passedCount,
      maxScore: graham.totalCount,
    },
    {
      name: 'Piotroski F-Score',
      value: `${piotroski.score}/9`,
      score: piotroski.score,
      maxScore: 9,
    },
    {
      name: 'Valuation',
      value: valuation.grahamMarginOfSafety > 0 ? 'Undervalued' : 'Overvalued',
      score: valuation.grahamMarginOfSafety > 0 ? 1 : 0,
      maxScore: 1,
    },
  ];

  return { recommendation, explanation, scorecard };
}

// ─── Top-level orchestrator ───────────────────────────────────────────────────

export function runStockAnalysis(stockData: StockData): StockValuationResult {
  const graham = buildGrahamAnalysis(stockData);
  const piotroski = buildPiotroskiAnalysis(stockData);
  const valuation = buildValuationAnalysis(stockData);
  const summary = buildSummary(stockData, graham, piotroski, valuation);

  return { assetType: 'stock', stockData, summary, graham, piotroski, valuation };
}
