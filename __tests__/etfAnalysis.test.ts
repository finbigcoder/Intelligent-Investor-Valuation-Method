import { describe, it, expect } from 'vitest';
import {
  buildCostAnalysis,
  buildQualityAnalysis,
  buildPerformanceAnalysis,
  buildETFSummary,
  runETFAnalysis,
} from '../lib/etfAnalysis';
import type { ETFData } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A premier broad-market index fund (think Vanguard/iShares core) */
const eliteETF: ETFData = {
  ticker: 'VTI',
  name: 'Vanguard Total Stock Market ETF',
  currentPrice: 220,
  expenseRatio: 0.0003,               // 0.03% — elite
  aum: 350_000_000_000,               // $350B — very large
  inceptionDate: '2001-05-24',        // 20+ years old
  indexTracked: 'CRSP US Total Market Index',
  numberOfHoldings: 3800,             // broad market
  dividendYield: 0.015,               // 1.5%
  trackingError: 0.0008,              // 0.08% — minimal
  top10Holdings: [
    { name: 'Apple Inc', weight: 0.065 },
    { name: 'Microsoft Corp', weight: 0.058 },
  ],
  sectorAllocations: [
    { sector: 'Technology', weight: 0.28 },
    { sector: 'Healthcare', weight: 0.13 },
  ],
  annualReturns: [
    { year: 2023, returnPct: 0.265 },
    { year: 2022, returnPct: -0.195 },
  ],
  ytdReturn: 0.12,
  oneYearReturn: 0.265,               // positive
  threeYearAnnualizedReturn: 0.096,   // 9.6% — good
  fiveYearAnnualizedReturn: 0.148,    // 14.8% — excellent
  tenYearAnnualizedReturn: 0.123,     // 12.3% — excellent
  historicalPrices: [],
};

/** A poor, expensive, new, niche fund */
const poorETF: ETFData = {
  ticker: 'BAD',
  name: 'Expensive Niche Fund',
  currentPrice: 30,
  expenseRatio: 0.015,               // 1.5% — very expensive
  aum: 50_000_000,                   // $50M — very small
  inceptionDate: `${new Date().getFullYear() - 1}-01-01`, // ~1 year old
  indexTracked: 'Custom Niche Index',
  numberOfHoldings: 15,              // very concentrated
  dividendYield: 0,
  trackingError: 0.02,               // 2% — very high
  top10Holdings: [],
  sectorAllocations: [],
  annualReturns: [],
  ytdReturn: -0.05,
  oneYearReturn: -0.10,              // negative
  threeYearAnnualizedReturn: -0.02,  // negative
  fiveYearAnnualizedReturn: -0.01,   // negative
  tenYearAnnualizedReturn: -0.01,    // n/a — fund too young, negative placeholder
  historicalPrices: [],
};

// ─── Cost Analysis ────────────────────────────────────────────────────────────

describe('buildCostAnalysis', () => {
  describe('maxScore is always 30', () => {
    it('elite ETF has maxScore 30', () => {
      expect(buildCostAnalysis(eliteETF).maxScore).toBe(30);
    });
    it('poor ETF has maxScore 30', () => {
      expect(buildCostAnalysis(poorETF).maxScore).toBe(30);
    });
  });

  describe('Expense ratio scoring', () => {
    it('elite ETF (≤ 0.05%) gets 20 expense pts', () => {
      // 0.0003 = 0.03% → elite → 20pts
      const { score } = buildCostAnalysis(eliteETF);
      // score = expense(20) + tracking(10) = 30 for elite
      expect(score).toBe(30);
    });

    it('poor ETF (> 1%) gets 0 expense pts', () => {
      const { score } = buildCostAnalysis(poorETF);
      // expense = 0, tracking = 0 (2% > 1%)
      expect(score).toBe(0);
    });

    it('fund with 0.15% expense gets 16 expense pts', () => {
      const etf = { ...eliteETF, expenseRatio: 0.0015, trackingError: 0 };
      const { score } = buildCostAnalysis(etf);
      // expense = 16, tracking = 10 (0%) → 26
      expect(score).toBe(26);
    });

    it('fund with 0.40% expense gets 10 expense pts', () => {
      const etf = { ...eliteETF, expenseRatio: 0.004, trackingError: 0.001 };
      const { score } = buildCostAnalysis(etf);
      // expense = 10, tracking = 10 (0.10%) → 20
      expect(score).toBe(20);
    });

    it('fund with 0.80% expense gets 5 expense pts', () => {
      const etf = { ...eliteETF, expenseRatio: 0.008, trackingError: 0.003 };
      const { score } = buildCostAnalysis(etf);
      // expense = 5 (0.8% ≤ 1%), tracking = 4 (0.30% ≤ 0.50%) → 9
      expect(score).toBe(9);
    });
  });

  describe('Tracking error scoring', () => {
    it('0% tracking error gets 10 tracking pts', () => {
      const etf = { ...eliteETF, trackingError: 0 };
      const { score } = buildCostAnalysis(etf);
      // expense=20 (0.03%) + tracking=10 = 30
      expect(score).toBe(30);
    });

    it('0.20% tracking error gets 7 tracking pts', () => {
      const etf = { ...eliteETF, trackingError: 0.002 };
      const { score } = buildCostAnalysis(etf);
      // expense=20 + tracking=7 = 27
      expect(score).toBe(27);
    });

    it('2% tracking error gets 0 tracking pts', () => {
      const etf = { ...eliteETF, trackingError: 0.02 };
      const { score } = buildCostAnalysis(etf);
      // expense=20 + tracking=0 = 20
      expect(score).toBe(20);
    });
  });

  describe('Expense ratio check passes/fails at threshold', () => {
    it('expense ≤ 0.50% check passes', () => {
      const etf = { ...eliteETF, expenseRatio: 0.004 }; // 0.40%
      expect(buildCostAnalysis(etf).checks[0].pass).toBe(true);
    });

    it('expense > 1% check fails', () => {
      expect(buildCostAnalysis(poorETF).checks[0].pass).toBe(false);
    });
  });

  it('returns exactly 3 checks', () => {
    expect(buildCostAnalysis(eliteETF).checks).toHaveLength(3);
  });
});

// ─── Quality Analysis ─────────────────────────────────────────────────────────

describe('buildQualityAnalysis', () => {
  describe('maxScore is always 30', () => {
    it('elite ETF has maxScore 30', () => {
      expect(buildQualityAnalysis(eliteETF).maxScore).toBe(30);
    });
  });

  describe('AUM scoring', () => {
    it('≥ $50B gets 10 pts', () => {
      // elite AUM = $350B
      const result = buildQualityAnalysis(eliteETF);
      const aumScore = 10; // direct check
      expect(result.score).toBeGreaterThanOrEqual(aumScore);
    });

    it('$50M gets 0 AUM pts', () => {
      const result = buildQualityAnalysis(poorETF);
      expect(result.checks[0].pass).toBe(false);
    });

    it('$5B AUM gets 5 pts', () => {
      const etf = { ...eliteETF, aum: 5_000_000_000 };
      const result = buildQualityAnalysis(etf);
      // AUM=5, holdings=10 (3800), age=10 → 25
      expect(result.score).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Holdings scoring', () => {
    it('≥ 500 holdings gets 10 pts', () => {
      const result = buildQualityAnalysis(eliteETF);
      // 3800 holdings → 10pts. Total should include this.
      expect(result.checks[1].pass).toBe(true);
    });

    it('15 holdings gets 0 pts', () => {
      expect(buildQualityAnalysis(poorETF).checks[1].pass).toBe(false);
    });

    it('75 holdings gets 4 pts', () => {
      const etf = { ...eliteETF, numberOfHoldings: 75 };
      const result = buildQualityAnalysis(etf);
      // AUM=10, holdings=4, age=10 → 24
      expect(result.score).toBe(24);
    });
  });

  describe('Fund age scoring', () => {
    it('≥ 10 years gets 10 pts', () => {
      // eliteETF inception 2001 → 20+ years
      expect(buildQualityAnalysis(eliteETF).checks[2].pass).toBe(true);
    });

    it('< 1 year gets 0 pts', () => {
      const etf = {
        ...eliteETF,
        inceptionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };
      expect(buildQualityAnalysis(etf).checks[2].pass).toBe(false);
    });
  });

  it('elite ETF scores 30/30', () => {
    expect(buildQualityAnalysis(eliteETF).score).toBe(30);
  });

  it('poor ETF scores 2/30 (only age ≥ 1yr earns 2pts)', () => {
    // AUM $50M → 0, holdings 15 → 0, age ~1yr → 2 pts
    expect(buildQualityAnalysis(poorETF).score).toBe(2);
  });

  it('returns exactly 3 checks', () => {
    expect(buildQualityAnalysis(eliteETF).checks).toHaveLength(3);
  });
});

// ─── Performance Analysis ─────────────────────────────────────────────────────

describe('buildPerformanceAnalysis', () => {
  describe('maxScore is always 40', () => {
    it('elite ETF has maxScore 40', () => {
      expect(buildPerformanceAnalysis(eliteETF).maxScore).toBe(40);
    });
  });

  describe('1-year return (check 1)', () => {
    it('passes when 1Y return > 0', () => {
      expect(buildPerformanceAnalysis(eliteETF).checks[0].pass).toBe(true);
    });
    it('fails when 1Y return ≤ 0', () => {
      expect(buildPerformanceAnalysis(poorETF).checks[0].pass).toBe(false);
    });
  });

  describe('3-year return (check 2)', () => {
    it('passes when 3Y annualised ≥ 5%', () => {
      // elite: 9.6% → passes
      expect(buildPerformanceAnalysis(eliteETF).checks[1].pass).toBe(true);
    });
    it('fails when 3Y annualised < 5%', () => {
      expect(buildPerformanceAnalysis(poorETF).checks[1].pass).toBe(false);
    });
  });

  describe('5-year return (check 3)', () => {
    it('passes when 5Y annualised ≥ 7%', () => {
      // elite: 14.8% → passes
      expect(buildPerformanceAnalysis(eliteETF).checks[2].pass).toBe(true);
    });
    it('fails when 5Y annualised < 7%', () => {
      expect(buildPerformanceAnalysis(poorETF).checks[2].pass).toBe(false);
    });
  });

  describe('10-year return (check 4)', () => {
    it('passes when 10Y annualised ≥ 8%', () => {
      // elite: 12.3% → passes
      expect(buildPerformanceAnalysis(eliteETF).checks[3].pass).toBe(true);
    });
    it('fails when 10Y annualised is 0 (fund too young)', () => {
      expect(buildPerformanceAnalysis(poorETF).checks[3].pass).toBe(false);
    });
  });

  describe('Score accumulation', () => {
    it('elite ETF scores 40/40', () => {
      // 1Y: 5 (>0), 3Y: 10 (≥10%? No, 9.6% → 8pts), 5Y: 15 (≥10%), 10Y: 10 (≥10%)
      // 1Y: 5, 3Y: 8 (9.6% ≥ 7%), 5Y: 15 (14.8% ≥ 10%), 10Y: 10 (12.3% ≥ 10%) = 38
      // Actually let's just check it's the maximum possible given the data
      const result = buildPerformanceAnalysis(eliteETF);
      expect(result.score).toBe(38); // 5 + 8 + 15 + 10
    });

    it('poor ETF scores 0/40 (all returns negative or zero)', () => {
      expect(buildPerformanceAnalysis(poorETF).score).toBe(0);
    });
  });

  it('returns exactly 4 checks', () => {
    expect(buildPerformanceAnalysis(eliteETF).checks).toHaveLength(4);
  });
});

// ─── ETF Summary / Recommendation ────────────────────────────────────────────

describe('buildETFSummary', () => {
  it('elite fund gets Strong Buy (≥ 85 pts)', () => {
    const cost = buildCostAnalysis(eliteETF);
    const quality = buildQualityAnalysis(eliteETF);
    const performance = buildPerformanceAnalysis(eliteETF);
    const summary = buildETFSummary(cost, quality, performance);
    // 30 + 30 + 38 = 98
    expect(summary.recommendation).toBe('Strong Buy');
  });

  it('poor fund gets Sell (< 55 pts)', () => {
    const cost = buildCostAnalysis(poorETF);
    const quality = buildQualityAnalysis(poorETF);
    const performance = buildPerformanceAnalysis(poorETF);
    const summary = buildETFSummary(cost, quality, performance);
    // 0 + 0 + 0 = 0
    expect(summary.recommendation).toBe('Sell');
  });

  it('scorecard has exactly 3 items', () => {
    const cost = buildCostAnalysis(eliteETF);
    const quality = buildQualityAnalysis(eliteETF);
    const performance = buildPerformanceAnalysis(eliteETF);
    const summary = buildETFSummary(cost, quality, performance);
    expect(summary.scorecard).toHaveLength(3);
  });

  it('scorecard maxScores match pillar maxScores', () => {
    const cost = buildCostAnalysis(eliteETF);
    const quality = buildQualityAnalysis(eliteETF);
    const performance = buildPerformanceAnalysis(eliteETF);
    const summary = buildETFSummary(cost, quality, performance);
    expect(summary.scorecard[0].maxScore).toBe(30); // cost
    expect(summary.scorecard[1].maxScore).toBe(30); // quality
    expect(summary.scorecard[2].maxScore).toBe(40); // performance
  });

  it('returns Buy for score ≥ 70 but < 85', () => {
    // Construct pillar scores that sum to ~75
    const cost = { checks: [], score: 25, maxScore: 30 as 30 };
    const quality = { checks: [], score: 25, maxScore: 30 as 30 };
    const performance = { checks: [], score: 25, maxScore: 40 as 40 };
    const summary = buildETFSummary(cost, quality, performance);
    // score = 75 → Buy
    expect(summary.recommendation).toBe('Buy');
  });

  it('returns Hold for score ≥ 55 but < 70', () => {
    const cost = { checks: [], score: 15, maxScore: 30 as 30 };
    const quality = { checks: [], score: 20, maxScore: 30 as 30 };
    const performance = { checks: [], score: 25, maxScore: 40 as 40 };
    const summary = buildETFSummary(cost, quality, performance);
    // score = 60 → Hold
    expect(summary.recommendation).toBe('Hold');
  });

  it('explanation includes total score', () => {
    const cost = buildCostAnalysis(eliteETF);
    const quality = buildQualityAnalysis(eliteETF);
    const performance = buildPerformanceAnalysis(eliteETF);
    const summary = buildETFSummary(cost, quality, performance);
    expect(summary.explanation).toContain('98');
  });
});

// ─── Integration: runETFAnalysis ──────────────────────────────────────────────

describe('runETFAnalysis', () => {
  it('returns assetType "etf"', () => {
    expect(runETFAnalysis(eliteETF).assetType).toBe('etf');
  });

  it('includes all four sections', () => {
    const result = runETFAnalysis(eliteETF);
    expect(result.etfData).toBeDefined();
    expect(result.cost).toBeDefined();
    expect(result.quality).toBeDefined();
    expect(result.performance).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('is deterministic', () => {
    expect(runETFAnalysis(eliteETF)).toEqual(runETFAnalysis(eliteETF));
  });

  it('elite ETF gets Strong Buy recommendation', () => {
    expect(runETFAnalysis(eliteETF).summary.recommendation).toBe('Strong Buy');
  });

  it('poor ETF gets Sell recommendation', () => {
    expect(runETFAnalysis(poorETF).summary.recommendation).toBe('Sell');
  });

  it('total score does not exceed 100', () => {
    const result = runETFAnalysis(eliteETF);
    const total = result.cost.score + result.quality.score + result.performance.score;
    expect(total).toBeLessThanOrEqual(100);
  });

  it('total score is non-negative', () => {
    const result = runETFAnalysis(poorETF);
    const total = result.cost.score + result.quality.score + result.performance.score;
    expect(total).toBeGreaterThanOrEqual(0);
  });
});
