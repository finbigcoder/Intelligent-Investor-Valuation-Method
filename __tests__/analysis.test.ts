import { describe, it, expect } from 'vitest';
import {
  buildGrahamAnalysis,
  buildPiotroskiAnalysis,
  buildValuationAnalysis,
  buildSummary,
  runStockAnalysis,
} from '../lib/analysis';
import type { StockData, GrahamAnalysis, PiotroskiAnalysis, ValuationAnalysis } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A healthy, value-priced company that passes most checks */
const healthyStock: StockData = {
  ticker: 'TEST',
  companyName: 'Test Corp',
  logoUrl: '',
  currentPrice: 50,
  marketCap: 5_000_000_000,         // $5B — passes adequate size
  eps: 5,                            // TTM
  bookValuePerShare: 20,
  currentAssets: 4_000_000_000,
  currentLiabilities: 1_500_000_000, // current ratio = 2.67 — passes
  roe: 0.15,
  debtToEquity: 0.5,
  longTermDebt: 2_000_000_000,       // ≤ net current assets ($2.5B) — passes
  hasPositiveEarningsLast10Years: true,
  hasUninterruptedDividendsLast20Years: true,
  eps10YearsAgo: 3,                  // growth = (5-3)/3 = 66.7% — passes
  threeYearAverageEPS: 4.5,          // P/E 3y = 50/4.5 = 11.1 — passes
  totalLiabilities: 2_500_000_000,
  preferredStockValue: 0,
  sharesOutstanding: { currentYear: 100_000_000, previousYear: 101_000_000 }, // slight buy-back
  roa: { currentYear: 0.08, previousYear: 0.06 },    // positive & improving
  operatingCashFlow: 600_000_000,    // positive
  netIncome: 500_000_000,            // OCF > netIncome — passes accruals check
  longTermDebtHistory: { currentYear: 0.3, previousYear: 0.4 }, // decreasing
  currentRatioHistory: { currentYear: 2.67, previousYear: 2.5 }, // improving
  grossMargin: { currentYear: 0.45, previousYear: 0.42 },        // improving
  assetTurnover: { currentYear: 0.8, previousYear: 0.75 },       // improving
  estimatedEPSGrowthRate: 0.12,      // 12% growth
  qualitativeAnalysis: { economicMoat: 'Wide moat', managementQuality: 'Excellent' },
  historicalPrices: [],
  historicalEPS: [],
  historicalDebtToEquity: [],
  historicalPE: [],
};

/** A distressed company that fails most checks */
const distressedStock: StockData = {
  ...healthyStock,
  ticker: 'DIST',
  companyName: 'Distressed Inc',
  currentPrice: 200,
  marketCap: 500_000_000,            // $0.5B — fails adequate size
  eps: -2,                           // negative EPS → Speculative recommendation
  threeYearAverageEPS: -1,
  bookValuePerShare: 5,
  currentAssets: 100_000_000,
  currentLiabilities: 200_000_000,  // current ratio = 0.5 — fails
  longTermDebt: 300_000_000,         // > net current assets (-$100M) — fails
  hasPositiveEarningsLast10Years: false,
  hasUninterruptedDividendsLast20Years: false,
  eps10YearsAgo: 5,                  // EPS declined significantly — fails growth
  roa: { currentYear: -0.05, previousYear: -0.03 }, // negative & worsening
  operatingCashFlow: -150_000_000,   // negative AND < netIncome → fails accruals check too
  netIncome: -100_000_000,
  longTermDebtHistory: { currentYear: 1.5, previousYear: 1.2 }, // increasing debt
  currentRatioHistory: { currentYear: 0.5, previousYear: 0.6 }, // worsening
  grossMargin: { currentYear: 0.10, previousYear: 0.15 },        // declining
  assetTurnover: { currentYear: 0.3, previousYear: 0.5 },        // declining
  sharesOutstanding: { currentYear: 110_000_000, previousYear: 100_000_000 }, // dilution
  estimatedEPSGrowthRate: 0,
};

// ─── Graham Analysis ──────────────────────────────────────────────────────────

describe('buildGrahamAnalysis', () => {
  describe('Adequate Size (check 1)', () => {
    it('passes when market cap ≥ $2B', () => {
      const result = buildGrahamAnalysis(healthyStock);
      expect(result.checklist[0].pass).toBe(true);
    });

    it('fails when market cap < $2B', () => {
      const result = buildGrahamAnalysis(distressedStock);
      expect(result.checklist[0].pass).toBe(false);
    });

    it('passes exactly at the $2B boundary', () => {
      const stock = { ...healthyStock, marketCap: 2_000_000_000 };
      expect(buildGrahamAnalysis(stock).checklist[0].pass).toBe(true);
    });

    it('fails just below the $2B boundary', () => {
      const stock = { ...healthyStock, marketCap: 1_999_999_999 };
      expect(buildGrahamAnalysis(stock).checklist[0].pass).toBe(false);
    });
  });

  describe('Current Ratio (check 2)', () => {
    it('passes when current ratio ≥ 2.0', () => {
      const result = buildGrahamAnalysis(healthyStock);
      expect(result.checklist[1].pass).toBe(true);
    });

    it('fails when current ratio < 2.0', () => {
      const result = buildGrahamAnalysis(distressedStock);
      expect(result.checklist[1].pass).toBe(false);
    });

    it('passes exactly at 2.0', () => {
      const stock = { ...healthyStock, currentRatioHistory: { currentYear: 2.0, previousYear: 1.9 } };
      expect(buildGrahamAnalysis(stock).checklist[1].pass).toBe(true);
    });

    it('fails at 1.99', () => {
      const stock = { ...healthyStock, currentRatioHistory: { currentYear: 1.99, previousYear: 2.1 } };
      expect(buildGrahamAnalysis(stock).checklist[1].pass).toBe(false);
    });
  });

  describe('Debt Load (check 3)', () => {
    it('passes when long-term debt ≤ net current assets', () => {
      // healthyStock: LTD = 2B, netCA = 4B - 1.5B = 2.5B → passes
      expect(buildGrahamAnalysis(healthyStock).checklist[2].pass).toBe(true);
    });

    it('fails when long-term debt > net current assets', () => {
      // distressedStock: LTD = 300M, netCA = 100M - 200M = -100M → fails
      expect(buildGrahamAnalysis(distressedStock).checklist[2].pass).toBe(false);
    });
  });

  describe('Earnings Stability (check 4)', () => {
    it('passes when all 10 years have positive earnings', () => {
      expect(buildGrahamAnalysis(healthyStock).checklist[3].pass).toBe(true);
    });

    it('fails when any year has negative earnings', () => {
      expect(buildGrahamAnalysis(distressedStock).checklist[3].pass).toBe(false);
    });
  });

  describe('Dividend Record (check 5)', () => {
    it('passes with 20 years of uninterrupted dividends', () => {
      expect(buildGrahamAnalysis(healthyStock).checklist[4].pass).toBe(true);
    });

    it('fails without 20 years of uninterrupted dividends', () => {
      expect(buildGrahamAnalysis(distressedStock).checklist[4].pass).toBe(false);
    });
  });

  describe('Earnings Growth (check 6)', () => {
    it('passes when 10-year EPS growth ≥ 33%', () => {
      // healthyStock: (5-3)/3 = 66.7% — passes
      expect(buildGrahamAnalysis(healthyStock).checklist[5].pass).toBe(true);
    });

    it('fails when 10-year EPS growth < 33%', () => {
      // (5-4)/4 = 25% — fails
      const stock = { ...healthyStock, eps10YearsAgo: 4 };
      expect(buildGrahamAnalysis(stock).checklist[5].pass).toBe(false);
    });

    it('passes exactly at 33%', () => {
      // (eps - eps10) / |eps10| = 0.33 → eps = 1.33 * eps10
      const stock = { ...healthyStock, eps: 1.33, eps10YearsAgo: 1 };
      expect(buildGrahamAnalysis(stock).checklist[5].pass).toBe(true);
    });

    it('handles negative eps10YearsAgo without crashing', () => {
      const stock = { ...healthyStock, eps: 5, eps10YearsAgo: -2 };
      expect(() => buildGrahamAnalysis(stock)).not.toThrow();
    });

    it('handles zero eps10YearsAgo (growth from zero → Infinity)', () => {
      const stock = { ...healthyStock, eps: 5, eps10YearsAgo: 0 };
      // growth = Infinity when eps > 0 → passes
      expect(buildGrahamAnalysis(stock).checklist[5].pass).toBe(true);
    });
  });

  describe('Moderate Valuation (check 7)', () => {
    it('passes when P/E ≤ 15 AND P/B ≤ 1.5', () => {
      // healthyStock: P/E(3y) = 50/4.5 ≈ 11.1, P/B = 50/20 = 2.5 — fails P/B but P/E×P/B = 27.7 > 22.5
      // So let's use a stock that satisfies both
      const stock = { ...healthyStock, currentPrice: 20, threeYearAverageEPS: 2, bookValuePerShare: 10 };
      // P/E = 10, P/B = 2 → P/E×P/B = 20 ≤ 22.5 — passes via product rule
      expect(buildGrahamAnalysis(stock).checklist[6].pass).toBe(true);
    });

    it('passes via the P/E × P/B ≤ 22.5 product rule', () => {
      // P/E = 14, P/B = 1.5 → product = 21 ≤ 22.5
      const stock = { ...healthyStock, currentPrice: 42, threeYearAverageEPS: 3, bookValuePerShare: 28 };
      // P/E = 14, P/B = 42/28 = 1.5 → product = 21 — passes
      expect(buildGrahamAnalysis(stock).checklist[6].pass).toBe(true);
    });

    it('fails when both conditions are violated and product > 22.5', () => {
      // P/E = 30, P/B = 5 → fails both conditions and product = 150 > 22.5
      const stock = { ...healthyStock, currentPrice: 150, threeYearAverageEPS: 5, bookValuePerShare: 30 };
      expect(buildGrahamAnalysis(stock).checklist[6].pass).toBe(false);
    });

    it('uses Infinity when threeYearAverageEPS ≤ 0', () => {
      const stock = { ...healthyStock, threeYearAverageEPS: 0 };
      // P/E = Infinity → fails
      expect(buildGrahamAnalysis(stock).checklist[6].pass).toBe(false);
    });
  });

  describe('passedCount and totalCount', () => {
    it('totalCount is always 7', () => {
      expect(buildGrahamAnalysis(healthyStock).totalCount).toBe(7);
      expect(buildGrahamAnalysis(distressedStock).totalCount).toBe(7);
    });

    it('passedCount equals number of passing checks', () => {
      const result = buildGrahamAnalysis(healthyStock);
      const manualCount = result.checklist.filter((c) => c.pass).length;
      expect(result.passedCount).toBe(manualCount);
    });

    it('healthy stock passes most checks', () => {
      const result = buildGrahamAnalysis(healthyStock);
      expect(result.passedCount).toBeGreaterThanOrEqual(5);
    });

    it('distressed stock fails most checks', () => {
      const result = buildGrahamAnalysis(distressedStock);
      expect(result.passedCount).toBeLessThanOrEqual(2);
    });
  });
});

// ─── Piotroski Analysis ───────────────────────────────────────────────────────

describe('buildPiotroskiAnalysis', () => {
  it('score is sum of passing checks', () => {
    const result = buildPiotroskiAnalysis(healthyStock);
    expect(result.score).toBe(result.checks.filter((c) => c.pass).length);
  });

  it('has exactly 9 checks', () => {
    expect(buildPiotroskiAnalysis(healthyStock).checks).toHaveLength(9);
  });

  describe('Check 1 — Positive ROA', () => {
    it('passes when ROA > 0', () => {
      expect(buildPiotroskiAnalysis(healthyStock).checks[0].pass).toBe(true);
    });

    it('fails when ROA ≤ 0', () => {
      expect(buildPiotroskiAnalysis(distressedStock).checks[0].pass).toBe(false);
    });
  });

  describe('Check 2 — Positive OCF', () => {
    it('passes when operatingCashFlow > 0', () => {
      expect(buildPiotroskiAnalysis(healthyStock).checks[1].pass).toBe(true);
    });

    it('fails when operatingCashFlow ≤ 0', () => {
      expect(buildPiotroskiAnalysis(distressedStock).checks[1].pass).toBe(false);
    });
  });

  describe('Check 3 — Increasing ROA', () => {
    it('passes when current ROA > previous ROA', () => {
      // healthyStock: 0.08 > 0.06 — passes
      expect(buildPiotroskiAnalysis(healthyStock).checks[2].pass).toBe(true);
    });

    it('fails when current ROA ≤ previous ROA', () => {
      const stock = { ...healthyStock, roa: { currentYear: 0.05, previousYear: 0.05 } };
      expect(buildPiotroskiAnalysis(stock).checks[2].pass).toBe(false);
    });
  });

  describe('Check 4 — Quality of Earnings (OCF > Net Income)', () => {
    it('passes when OCF > netIncome', () => {
      // healthyStock: 600M > 500M — passes
      expect(buildPiotroskiAnalysis(healthyStock).checks[3].pass).toBe(true);
    });

    it('fails when OCF ≤ netIncome', () => {
      const stock = { ...healthyStock, operatingCashFlow: 400_000_000, netIncome: 500_000_000 };
      expect(buildPiotroskiAnalysis(stock).checks[3].pass).toBe(false);
    });
  });

  describe('Check 5 — Decreasing Long-Term Debt', () => {
    it('passes when LT debt ratio decreased', () => {
      // healthyStock: 0.3 < 0.4 — passes
      expect(buildPiotroskiAnalysis(healthyStock).checks[4].pass).toBe(true);
    });

    it('fails when LT debt ratio increased', () => {
      expect(buildPiotroskiAnalysis(distressedStock).checks[4].pass).toBe(false);
    });
  });

  describe('Check 6 — Increasing Current Ratio', () => {
    it('passes when current ratio improved', () => {
      expect(buildPiotroskiAnalysis(healthyStock).checks[5].pass).toBe(true);
    });

    it('fails when current ratio worsened', () => {
      expect(buildPiotroskiAnalysis(distressedStock).checks[5].pass).toBe(false);
    });
  });

  describe('Check 7 — No New Share Issuance', () => {
    it('passes when shares did not increase', () => {
      // healthyStock: 100M ≤ 101M — passes (buyback)
      expect(buildPiotroskiAnalysis(healthyStock).checks[6].pass).toBe(true);
    });

    it('fails when shares increased', () => {
      // distressedStock: 110M > 100M — fails
      expect(buildPiotroskiAnalysis(distressedStock).checks[6].pass).toBe(false);
    });
  });

  describe('Check 8 — Increasing Gross Margin', () => {
    it('passes when gross margin improved', () => {
      expect(buildPiotroskiAnalysis(healthyStock).checks[7].pass).toBe(true);
    });

    it('fails when gross margin declined', () => {
      expect(buildPiotroskiAnalysis(distressedStock).checks[7].pass).toBe(false);
    });
  });

  describe('Check 9 — Increasing Asset Turnover', () => {
    it('passes when asset turnover improved', () => {
      expect(buildPiotroskiAnalysis(healthyStock).checks[8].pass).toBe(true);
    });

    it('fails when asset turnover declined', () => {
      expect(buildPiotroskiAnalysis(distressedStock).checks[8].pass).toBe(false);
    });
  });

  it('healthy stock scores 9/9', () => {
    expect(buildPiotroskiAnalysis(healthyStock).score).toBe(9);
  });

  it('distressed stock scores 0/9', () => {
    expect(buildPiotroskiAnalysis(distressedStock).score).toBe(0);
  });
});

// ─── Valuation Analysis ───────────────────────────────────────────────────────

describe('buildValuationAnalysis', () => {
  describe('Graham Number', () => {
    it('calculates correctly: √(22.5 × EPS × BVS)', () => {
      // √(22.5 × 5 × 20) = √2250 ≈ 47.43
      const result = buildValuationAnalysis(healthyStock);
      expect(result.grahamNumber).toBeCloseTo(Math.sqrt(22.5 * 5 * 20), 4);
    });

    it('returns 0 when EPS ≤ 0', () => {
      const result = buildValuationAnalysis(distressedStock);
      expect(result.grahamNumber).toBe(0);
    });

    it('returns 0 when bookValuePerShare ≤ 0', () => {
      const stock = { ...healthyStock, bookValuePerShare: 0 };
      expect(buildValuationAnalysis(stock).grahamNumber).toBe(0);
    });

    it('returns 0 when both EPS and BVS are negative', () => {
      const stock = { ...healthyStock, eps: -1, bookValuePerShare: -5 };
      expect(buildValuationAnalysis(stock).grahamNumber).toBe(0);
    });
  });

  describe('Graham Margin of Safety', () => {
    it('is positive when stock is undervalued vs Graham Number', () => {
      // grahamNumber ≈ 47.43, currentPrice = 50 → slightly overvalued for this fixture
      // Let's use a cheaper price
      const stock = { ...healthyStock, currentPrice: 30 };
      const result = buildValuationAnalysis(stock);
      expect(result.grahamMarginOfSafety).toBeGreaterThan(0);
    });

    it('is negative when stock is overvalued vs Graham Number', () => {
      // currentPrice = 50, grahamNumber ≈ 47.43
      const result = buildValuationAnalysis(healthyStock);
      expect(result.grahamMarginOfSafety).toBeLessThan(0);
    });

    it('is -Infinity when Graham Number is 0', () => {
      const result = buildValuationAnalysis(distressedStock);
      expect(result.grahamMarginOfSafety).toBe(-Infinity);
    });

    it('equals (grahamNumber - price) / grahamNumber', () => {
      const result = buildValuationAnalysis(healthyStock);
      const gn = Math.sqrt(22.5 * 5 * 20);
      const expected = (gn - 50) / gn;
      expect(result.grahamMarginOfSafety).toBeCloseTo(expected, 6);
    });
  });

  describe('NCAV per share', () => {
    it('calculates correctly: (currentAssets - totalLiabilities - preferredStock) / shares', () => {
      // healthyStock: (4B - 2.5B - 0) / 100M = 15
      const result = buildValuationAnalysis(healthyStock);
      expect(result.ncavPerShare).toBeCloseTo(15, 4);
    });

    it('returns 0 when shares outstanding is 0', () => {
      const stock = { ...healthyStock, sharesOutstanding: { currentYear: 0, previousYear: 0 } };
      expect(buildValuationAnalysis(stock).ncavPerShare).toBe(0);
    });
  });

  describe('NCAV Margin of Safety', () => {
    it('is positive when NCAV per share > current price', () => {
      // ncavPerShare = 15 > currentPrice 12 → positive MoS
      const stock = { ...healthyStock, currentPrice: 12 };
      expect(buildValuationAnalysis(stock).ncavMarginOfSafety).toBeGreaterThan(0);
    });

    it('is negative when NCAV per share < current price', () => {
      // ncavPerShare = 15 < currentPrice 50
      expect(buildValuationAnalysis(healthyStock).ncavMarginOfSafety).toBeLessThan(0);
    });

    it('is -Infinity when ncavPerShare ≤ 0', () => {
      const stock = { ...healthyStock, totalLiabilities: 10_000_000_000 };
      expect(buildValuationAnalysis(stock).ncavMarginOfSafety).toBe(-Infinity);
    });
  });

  describe('PEG Ratio', () => {
    it('calculates correctly: P/E ÷ (growth × 100)', () => {
      // P/E = 50/5 = 10, growth = 12% → PEG = 10/12 ≈ 0.833
      const result = buildValuationAnalysis(healthyStock);
      expect(result.pegRatio).toBeCloseTo(10 / 12, 4);
    });

    it('returns Infinity when EPS ≤ 0', () => {
      const result = buildValuationAnalysis(distressedStock);
      expect(result.pegRatio).toBe(Infinity);
    });

    it('returns Infinity when growth rate is 0', () => {
      const stock = { ...healthyStock, estimatedEPSGrowthRate: 0 };
      expect(buildValuationAnalysis(stock).pegRatio).toBe(Infinity);
    });
  });

  describe('Lynch Fair Value', () => {
    it('calculates correctly: EPS × (growth%)', () => {
      // 5 × (0.12 × 100) = 5 × 12 = 60
      expect(buildValuationAnalysis(healthyStock).lynchFairValue).toBeCloseTo(60, 4);
    });

    it('is negative when EPS is negative and growth > 0', () => {
      const stock = { ...distressedStock, eps: -5, estimatedEPSGrowthRate: 0.10 };
      const result = buildValuationAnalysis(stock);
      // -5 × (0.10 × 100) = -50 → negative
      expect(result.lynchFairValue).toBeLessThan(0);
    });
  });
});

// ─── Recommendation Engine ────────────────────────────────────────────────────

describe('buildSummary', () => {
  it('returns Speculative when EPS ≤ 0, regardless of scores', () => {
    const graham = buildGrahamAnalysis(distressedStock);
    const piotroski = buildPiotroskiAnalysis(distressedStock);
    const valuation = buildValuationAnalysis(distressedStock);
    const summary = buildSummary(distressedStock, graham, piotroski, valuation);
    expect(summary.recommendation).toBe('Speculative');
  });

  it('returns Strong Buy when total score ≥ 80', () => {
    // Max Graham score: 40pts, max Piotroski: 40pts, valuation bonuses: up to 20pts
    // healthyStock passes 6/7 Graham, 9/9 Piotroski
    // Graham: (6/7)*40 ≈ 34.3, Piotroski: (9/9)*40 = 40 → 74.3 base
    // Need valuation bonuses to push ≥ 80 → override with a cheap price
    const stock = { ...healthyStock, currentPrice: 10, estimatedEPSGrowthRate: 0.5 };
    const graham = buildGrahamAnalysis(stock);
    const piotroski = buildPiotroskiAnalysis(stock);
    const valuation = buildValuationAnalysis(stock);
    const summary = buildSummary(stock, graham, piotroski, valuation);
    // PEG = (10/5)/(0.5*100) = 2/50 = 0.04 < 1 → +10pts; grahamMoS very positive → +10pts
    expect(summary.recommendation).toBe('Strong Buy');
  });

  it('scorecard always has 3 items', () => {
    const graham = buildGrahamAnalysis(healthyStock);
    const piotroski = buildPiotroskiAnalysis(healthyStock);
    const valuation = buildValuationAnalysis(healthyStock);
    const summary = buildSummary(healthyStock, graham, piotroski, valuation);
    expect(summary.scorecard).toHaveLength(3);
  });

  it('scorecard reflects correct max scores', () => {
    const graham = buildGrahamAnalysis(healthyStock);
    const piotroski = buildPiotroskiAnalysis(healthyStock);
    const valuation = buildValuationAnalysis(healthyStock);
    const summary = buildSummary(healthyStock, graham, piotroski, valuation);
    expect(summary.scorecard[0].maxScore).toBe(7);   // Graham 7-item checklist
    expect(summary.scorecard[1].maxScore).toBe(9);   // Piotroski 9-point score
    expect(summary.scorecard[2].maxScore).toBe(1);   // Valuation binary
  });

  it('Valuation scorecard value shows Undervalued when margin > 0', () => {
    const stock = { ...healthyStock, currentPrice: 10 };
    const graham = buildGrahamAnalysis(stock);
    const piotroski = buildPiotroskiAnalysis(stock);
    const valuation = buildValuationAnalysis(stock);
    const summary = buildSummary(stock, graham, piotroski, valuation);
    expect(summary.scorecard[2].value).toBe('Undervalued');
  });

  it('Valuation scorecard value shows Overvalued when margin ≤ 0', () => {
    const graham = buildGrahamAnalysis(healthyStock);
    const piotroski = buildPiotroskiAnalysis(healthyStock);
    const valuation = buildValuationAnalysis(healthyStock);
    const summary = buildSummary(healthyStock, graham, piotroski, valuation);
    // healthyStock: currentPrice=50, grahamNumber≈47.4 → MoS < 0 → Overvalued
    expect(summary.scorecard[2].value).toBe('Overvalued');
  });

  it('total score includes Graham 40% weight', () => {
    // If Graham = 0/7 and Piotroski = 0/9 and no valuation bonuses → Sell
    const zeroGraham: GrahamAnalysis = { checklist: [], passedCount: 0, totalCount: 7 };
    const zeroPiotroski: PiotroskiAnalysis = { score: 0, checks: [] };
    const zeroValuation: ValuationAnalysis = {
      grahamNumber: 0, grahamMarginOfSafety: -Infinity,
      ncavPerShare: 0, ncavMarginOfSafety: -Infinity,
      pegRatio: Infinity, lynchFairValue: 0,
    };
    const stockWithPositiveEPS = { ...healthyStock, eps: 1 };
    const summary = buildSummary(stockWithPositiveEPS, zeroGraham, zeroPiotroski, zeroValuation);
    expect(summary.recommendation).toBe('Sell');
  });
});

// ─── Integration: runStockAnalysis ───────────────────────────────────────────

describe('runStockAnalysis', () => {
  it('returns assetType "stock"', () => {
    expect(runStockAnalysis(healthyStock).assetType).toBe('stock');
  });

  it('includes stockData, summary, graham, piotroski, valuation', () => {
    const result = runStockAnalysis(healthyStock);
    expect(result.stockData).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.graham).toBeDefined();
    expect(result.piotroski).toBeDefined();
    expect(result.valuation).toBeDefined();
  });

  it('is deterministic — same input produces same output', () => {
    expect(runStockAnalysis(healthyStock)).toEqual(runStockAnalysis(healthyStock));
  });

  it('distressed stock receives Speculative recommendation', () => {
    expect(runStockAnalysis(distressedStock).summary.recommendation).toBe('Speculative');
  });
});
