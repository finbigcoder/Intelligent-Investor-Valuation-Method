/**
 * Pure ETF / index-fund analysis functions — no React, no side effects.
 * Scoring is broken into three pillars: Cost (30pts), Quality (30pts), Performance (40pts).
 * Total score is 0-100 and maps to the same Recommendation scale used for stocks.
 */

import type {
  ETFData,
  ETFValuationResult,
  ETFCostAnalysis,
  ETFQualityAnalysis,
  ETFPerformanceAnalysis,
  AnalysisSummary,
  ChecklistItem,
  Recommendation,
} from '../types';

// ─── Cost Analysis (0-30 pts) ─────────────────────────────────────────────────

/**
 * Cost pillar — rewards low expense ratios.
 *
 * Thresholds (industry standard benchmarks):
 *   ≤ 0.05% → elite passive ETF territory (Vanguard/iShares/Schwab core)
 *   ≤ 0.20% → acceptable for broad-market ETFs
 *   ≤ 0.50% → acceptable for niche/sector ETFs
 *   ≤ 1.00% → expensive but still investable
 *   >  1.00% → avoid (most active funds)
 */
export function buildCostAnalysis(data: ETFData): ETFCostAnalysis {
  const { expenseRatio, trackingError, dividendYield } = data;
  const expensePct = expenseRatio * 100;
  const trackingPct = trackingError * 100;

  // --- Expense ratio score (0-20 pts) ---
  let expenseScore = 0;
  let expenseLabel: string;
  if (expensePct <= 0.05) {
    expenseScore = 20;
    expenseLabel = 'Elite (≤ 0.05%)';
  } else if (expensePct <= 0.20) {
    expenseScore = 16;
    expenseLabel = 'Excellent (≤ 0.20%)';
  } else if (expensePct <= 0.50) {
    expenseScore = 10;
    expenseLabel = 'Acceptable (≤ 0.50%)';
  } else if (expensePct <= 1.00) {
    expenseScore = 5;
    expenseLabel = 'Expensive (≤ 1.00%)';
  } else {
    expenseScore = 0;
    expenseLabel = 'Very expensive (> 1.00%)';
  }

  // --- Tracking error (0-10 pts) ---
  let trackingScore = 0;
  let trackingLabel: string;
  if (trackingPct <= 0.10) {
    trackingScore = 10;
    trackingLabel = 'Minimal (≤ 0.10%)';
  } else if (trackingPct <= 0.25) {
    trackingScore = 7;
    trackingLabel = 'Low (≤ 0.25%)';
  } else if (trackingPct <= 0.50) {
    trackingScore = 4;
    trackingLabel = 'Moderate (≤ 0.50%)';
  } else if (trackingPct <= 1.00) {
    trackingScore = 2;
    trackingLabel = 'High (≤ 1.00%)';
  } else {
    trackingScore = 0;
    trackingLabel = 'Very high (> 1.00%)';
  }

  const checks: ChecklistItem[] = [
    {
      name: 'Expense Ratio',
      pass: expenseScore >= 10,
      value: `${expensePct.toFixed(2)}% — ${expenseLabel}`,
      description:
        'Annual management fee. Lower is better; elite passive ETFs charge ≤ 0.05%.',
    },
    {
      name: 'Tracking Error',
      pass: trackingScore >= 4,
      value: `${trackingPct.toFixed(2)}% — ${trackingLabel}`,
      description:
        'Standard deviation of returns vs the benchmark index. Should be as low as possible.',
    },
    {
      name: 'Dividend Yield',
      pass: dividendYield >= 0,
      value: `${(dividendYield * 100).toFixed(2)}%`,
      description: 'Annual distributions as a percentage of NAV.',
    },
  ];

  const score = expenseScore + trackingScore;

  return { checks, score, maxScore: 30 };
}

// ─── Quality / Scale Analysis (0-30 pts) ─────────────────────────────────────

/**
 * Quality pillar — rewards size, breadth of diversification, and longevity.
 */
export function buildQualityAnalysis(data: ETFData): ETFQualityAnalysis {
  const { aum, numberOfHoldings, inceptionDate } = data;

  // --- AUM (0-10 pts) ---
  let aumScore = 0;
  let aumLabel: string;
  if (aum >= 50_000_000_000) {
    aumScore = 10;
    aumLabel = `$${(aum / 1e9).toFixed(0)}B — Very large, highly liquid`;
  } else if (aum >= 10_000_000_000) {
    aumScore = 8;
    aumLabel = `$${(aum / 1e9).toFixed(0)}B — Large, liquid`;
  } else if (aum >= 1_000_000_000) {
    aumScore = 5;
    aumLabel = `$${(aum / 1e9).toFixed(1)}B — Adequate`;
  } else if (aum >= 100_000_000) {
    aumScore = 2;
    aumLabel = `$${(aum / 1e6).toFixed(0)}M — Small`;
  } else {
    aumScore = 0;
    aumLabel = `$${(aum / 1e6).toFixed(0)}M — Very small / illiquid risk`;
  }

  // --- Holdings (0-10 pts) ---
  let holdingsScore = 0;
  let holdingsLabel: string;
  if (numberOfHoldings >= 500) {
    holdingsScore = 10;
    holdingsLabel = `${numberOfHoldings} — Broad market exposure`;
  } else if (numberOfHoldings >= 100) {
    holdingsScore = 7;
    holdingsLabel = `${numberOfHoldings} — Good diversification`;
  } else if (numberOfHoldings >= 50) {
    holdingsScore = 4;
    holdingsLabel = `${numberOfHoldings} — Moderate diversification`;
  } else if (numberOfHoldings >= 20) {
    holdingsScore = 2;
    holdingsLabel = `${numberOfHoldings} — Limited diversification`;
  } else {
    holdingsScore = 0;
    holdingsLabel = `${numberOfHoldings} — Concentrated / sector-specific`;
  }

  // --- Fund age (0-10 pts) ---
  const inceptionYear = new Date(inceptionDate).getFullYear();
  const currentYear = new Date().getFullYear();
  const ageYears = currentYear - inceptionYear;
  let ageScore = 0;
  let ageLabel: string;
  if (ageYears >= 10) {
    ageScore = 10;
    ageLabel = `${ageYears} years — Proven track record`;
  } else if (ageYears >= 5) {
    ageScore = 7;
    ageLabel = `${ageYears} years — Good track record`;
  } else if (ageYears >= 3) {
    ageScore = 4;
    ageLabel = `${ageYears} years — Limited track record`;
  } else if (ageYears >= 1) {
    ageScore = 2;
    ageLabel = `${ageYears} year(s) — Very new fund`;
  } else {
    ageScore = 0;
    ageLabel = `< 1 year — Unproven`;
  }

  const checks: ChecklistItem[] = [
    {
      name: 'Assets Under Management (AUM)',
      pass: aumScore >= 5,
      value: aumLabel,
      description:
        'Total assets managed. Larger AUM means tighter bid-ask spreads and lower closure risk.',
    },
    {
      name: 'Number of Holdings',
      pass: holdingsScore >= 4,
      value: holdingsLabel,
      description:
        'Number of underlying securities. More holdings generally means better diversification.',
    },
    {
      name: 'Fund Longevity',
      pass: ageScore >= 4,
      value: ageLabel,
      description:
        'Age of the fund. Older funds have demonstrated survival across multiple market cycles.',
    },
  ];

  const score = aumScore + holdingsScore + ageScore;
  return { checks, score, maxScore: 30 };
}

// ─── Performance Analysis (0-40 pts) ─────────────────────────────────────────

/**
 * Performance pillar — rewards consistent positive returns across timeframes.
 * We intentionally avoid chasing recent performance by weighting longer horizons.
 */
export function buildPerformanceAnalysis(data: ETFData): ETFPerformanceAnalysis {
  const {
    oneYearReturn,
    threeYearAnnualizedReturn,
    fiveYearAnnualizedReturn,
    tenYearAnnualizedReturn,
  } = data;

  const one1Y = oneYearReturn * 100;
  const ann3Y = threeYearAnnualizedReturn * 100;
  const ann5Y = fiveYearAnnualizedReturn * 100;
  const ann10Y = tenYearAnnualizedReturn * 100;

  // 1-year return (0-5 pts)
  const pass1Y = one1Y > 0;
  const score1Y = pass1Y ? 5 : 0;

  // 3-year annualised (0-10 pts)
  let score3Y = 0;
  if (ann3Y >= 10) score3Y = 10;
  else if (ann3Y >= 7) score3Y = 8;
  else if (ann3Y >= 5) score3Y = 6;
  else if (ann3Y >= 0) score3Y = 3;

  // 5-year annualised (0-15 pts)
  let score5Y = 0;
  if (ann5Y >= 10) score5Y = 15;
  else if (ann5Y >= 7) score5Y = 12;
  else if (ann5Y >= 5) score5Y = 8;
  else if (ann5Y >= 0) score5Y = 4;

  // 10-year annualised (0-10 pts)
  let score10Y = 0;
  if (ann10Y >= 10) score10Y = 10;
  else if (ann10Y >= 8) score10Y = 8;
  else if (ann10Y >= 6) score10Y = 6;
  else if (ann10Y >= 0) score10Y = 3;

  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  const checks: ChecklistItem[] = [
    {
      name: '1-Year Return',
      pass: pass1Y,
      value: fmt(one1Y),
      description: 'Total return over the past 12 months.',
    },
    {
      name: '3-Year Annualised Return',
      pass: ann3Y >= 5,
      value: fmt(ann3Y) + ' p.a.',
      description:
        'Annualised return over 3 years. We look for ≥ 5% as a reasonable threshold.',
    },
    {
      name: '5-Year Annualised Return',
      pass: ann5Y >= 7,
      value: fmt(ann5Y) + ' p.a.',
      description:
        'Annualised return over 5 years. We look for ≥ 7% (approx. long-run equity average).',
    },
    {
      name: '10-Year Annualised Return',
      pass: ann10Y >= 8,
      value: fmt(ann10Y) + ' p.a.',
      description:
        'Annualised return over 10 years. We look for ≥ 8%, consistent with equity benchmarks.',
    },
  ];

  const score = score1Y + score3Y + score5Y + score10Y;
  return { checks, score, maxScore: 40 };
}

// ─── Summary / Recommendation ─────────────────────────────────────────────────

export function buildETFSummary(
  cost: ETFCostAnalysis,
  quality: ETFQualityAnalysis,
  performance: ETFPerformanceAnalysis
): AnalysisSummary {
  const totalScore = cost.score + quality.score + performance.score; // 0-100

  let recommendation: Recommendation;
  let explanation: string;

  if (totalScore >= 85) {
    recommendation = 'Strong Buy';
    explanation = `An exceptional fund, scoring ${totalScore}/100. It combines minimal costs, institutional scale, and strong long-term performance — a core holding candidate.`;
  } else if (totalScore >= 70) {
    recommendation = 'Buy';
    explanation = `A solid fund, scoring ${totalScore}/100. It scores well across cost, quality, and performance and is suitable for most long-term portfolios.`;
  } else if (totalScore >= 55) {
    recommendation = 'Hold';
    explanation = `A mixed result, scoring ${totalScore}/100. The fund is acceptable but has room for improvement — compare against lower-cost or better-diversified alternatives.`;
  } else {
    recommendation = 'Sell';
    explanation = `A weak candidate, scoring ${totalScore}/100. The fund has significant drawbacks in cost, scale, or performance. Consider switching to a higher-quality alternative.`;
  }

  const scorecard = [
    {
      name: 'Cost Score',
      value: `${cost.score}/${cost.maxScore}`,
      score: cost.score,
      maxScore: cost.maxScore,
    },
    {
      name: 'Quality Score',
      value: `${quality.score}/${quality.maxScore}`,
      score: quality.score,
      maxScore: quality.maxScore,
    },
    {
      name: 'Performance Score',
      value: `${performance.score}/${performance.maxScore}`,
      score: performance.score,
      maxScore: performance.maxScore,
    },
  ];

  return { recommendation, explanation, scorecard };
}

// ─── Top-level orchestrator ───────────────────────────────────────────────────

export function runETFAnalysis(etfData: ETFData): ETFValuationResult {
  const cost = buildCostAnalysis(etfData);
  const quality = buildQualityAnalysis(etfData);
  const performance = buildPerformanceAnalysis(etfData);
  const summary = buildETFSummary(cost, quality, performance);

  return { assetType: 'etf', etfData, cost, quality, performance, summary };
}
