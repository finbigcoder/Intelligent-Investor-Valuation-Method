/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Express backend — fetches financial data via yahoo-finance2 (no API key needed).
 */

import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import type { StockData, ETFData } from '../types';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_MS = 15 * 60 * 1000;
interface Entry<T> { data: T; ts: number }
const stockCache = new Map<string, Entry<StockData>>();
const etfCache   = new Map<string, Entry<ETFData>>();
const fresh = <T>(e: Entry<T> | undefined): e is Entry<T> =>
  !!e && Date.now() - e.ts < CACHE_MS;

function num(v: any, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'number') return isFinite(v) ? v : fallback;
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

// ─── Historical prices from chart ────────────────────────────────────────────

async function getHistoricalPrices(ticker: string): Promise<{ date: string; price: number }[]> {
  try {
    const chart: any = await yahooFinance.chart(ticker, { interval: '1mo', period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000) });
    return (chart?.quotes ?? [])
      .filter((q: any) => q.date && q.close != null)
      .map((q: any) => ({
        date: new Date(q.date).toISOString().split('T')[0],
        price: num(q.close),
      }));
  } catch {
    return [];
  }
}

// ─── Stock data ───────────────────────────────────────────────────────────────

async function buildStockData(ticker: string): Promise<StockData> {
  const [summary, historicalPrices] = await Promise.all([
    yahooFinance.quoteSummary(ticker, {
      modules: [
        'price', 'defaultKeyStatistics', 'financialData', 'summaryDetail',
        'incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory',
        'earningsHistory', 'earningsTrend', 'assetProfile',
      ],
    }) as Promise<any>,
    getHistoricalPrices(ticker),
  ]);

  const price   = summary.price                ?? {};
  const stats   = summary.defaultKeyStatistics ?? {};
  const fin     = summary.financialData        ?? {};
  const detail  = summary.summaryDetail        ?? {};
  const profile = summary.assetProfile         ?? {};

  const incomes = summary.incomeStatementHistory?.incomeStatementHistory ?? [];
  const sheets  = summary.balanceSheetHistory?.balanceSheetStatements    ?? [];
  const cflows  = summary.cashflowStatementHistory?.cashflowStatements   ?? [];
  const epsHist = summary.earningsHistory?.history ?? [];
  const trend   = summary.earningsTrend?.trend    ?? [];

  const inc0 = incomes[0] ?? {};  const inc1 = incomes[1] ?? {};
  const bs0  = sheets[0]  ?? {};  const bs1  = sheets[1]  ?? {};
  const cf0  = cflows[0]  ?? {};

  const ca0 = num(bs0.totalCurrentAssets);    const cl0 = num(bs0.totalCurrentLiabilities);
  const ca1 = num(bs1.totalCurrentAssets);    const cl1 = num(bs1.totalCurrentLiabilities);
  const cr0 = cl0 > 0 ? ca0 / cl0 : 0;
  const cr1 = cl1 > 0 ? ca1 / cl1 : 0;

  const rev0 = num(inc0.totalRevenue);  const rev1 = num(inc1.totalRevenue);
  const gp0  = num(inc0.grossProfit);   const gp1  = num(inc1.grossProfit);
  const gm0  = rev0 > 0 ? gp0 / rev0 : 0;
  const gm1  = rev1 > 0 ? gp1 / rev1 : 0;

  const ta0 = num(bs0.totalAssets);  const ta1 = num(bs1.totalAssets);
  const at0 = ta0 > 0 ? rev0 / ta0 : 0;
  const at1 = ta1 > 0 ? rev1 / ta1 : 0;

  const ni0  = num(inc0.netIncome);  const ni1 = num(inc1.netIncome);
  const roa0 = num(fin.returnOnAssets) || (ta0 > 0 ? ni0 / ta0 : 0);
  const roa1 = ta1 > 0 ? ni1 / ta1 : 0;

  // Annual EPS from quarterly history
  const annualMap = new Map<number, number[]>();
  for (const h of epsHist) {
    if (!h.quarter) continue;
    const yr = new Date(h.quarter).getFullYear();
    if (!annualMap.has(yr)) annualMap.set(yr, []);
    annualMap.get(yr)!.push(num(h.epsActual));
  }
  const historicalEPS = [...annualMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, vals]) => ({ year, eps: vals.reduce((s, v) => s + v, 0) }));

  const eps      = num(stats.trailingEps) || num(fin.revenuePerShare) || 0;
  const eps10ago = historicalEPS.length >= 10 ? historicalEPS[historicalEPS.length - 10].eps
    : historicalEPS.length > 0 ? historicalEPS[0].eps : 0;
  const avg3yEPS = historicalEPS.length >= 3
    ? historicalEPS.slice(-3).reduce((s, e) => s + e.eps, 0) / 3 : eps;

  const fiveYr   = trend.find((t: any) => t.period === '+5y');
  const oneYr    = trend.find((t: any) => t.period === '+1y');
  const epsGrowth = num(fiveYr?.growth) || num(oneYr?.growth) || num(fin.revenueGrowth) || 0.07;

  const ltd0   = num(bs0.longTermDebt);
  const ltd1   = num(bs1.longTermDebt);
  const shares0 = num(stats.sharesOutstanding) || 1;
  const shares1 = num(stats.impliedSharesOutstanding) || shares0;
  const divYield = num(detail.dividendYield) || num(stats.dividendYield) || 0;

  const website = String(profile.website ?? '').replace(/https?:\/\/(www\.)?/, '').split('/')[0];
  const logoUrl = website
    ? `https://logo.clearbit.com/${website}`
    : `https://assets.parqet.com/logos/symbol/${ticker}`;

  return {
    ticker: ticker.toUpperCase(),
    companyName:  String(price.longName ?? price.shortName ?? ticker),
    logoUrl,
    currentPrice: num(price.regularMarketPrice),
    marketCap:    num(price.marketCap),
    eps,
    bookValuePerShare:  num(stats.bookValue),
    currentAssets:      ca0,
    currentLiabilities: cl0,
    roe:          num(fin.returnOnEquity),
    debtToEquity: num(fin.debtToEquity) / 100,
    longTermDebt: ltd0,
    hasPositiveEarningsLast10Years:
      historicalEPS.length >= 5 ? historicalEPS.slice(-10).every(e => e.eps > 0) : eps > 0,
    hasUninterruptedDividendsLast20Years:
      divYield > 0 && num(stats.fiveYearAvgDividendYield) > 0,
    eps10YearsAgo:       eps10ago,
    threeYearAverageEPS: avg3yEPS,
    totalLiabilities:    num(bs0.totalLiab),
    preferredStockValue: 0,
    sharesOutstanding:   { currentYear: shares0, previousYear: shares1 },
    roa:                 { currentYear: roa0,    previousYear: roa1 },
    operatingCashFlow:   num(cf0.totalCashFromOperatingActivities) || num(fin.operatingCashflow),
    netIncome:           ni0,
    longTermDebtHistory: { currentYear: ltd0, previousYear: ltd1 },
    currentRatioHistory: { currentYear: cr0,  previousYear: cr1  },
    grossMargin:         { currentYear: gm0,  previousYear: gm1  },
    assetTurnover:       { currentYear: at0,  previousYear: at1  },
    estimatedEPSGrowthRate: epsGrowth,
    qualitativeAnalysis: {
      economicMoat: String(profile.longBusinessSummary ?? '').slice(0, 300) ||
        `${profile.sector ?? ''} company in ${profile.industry ?? ''}.`,
      managementQuality:
        `Sector: ${profile.sector ?? 'N/A'}. Industry: ${profile.industry ?? 'N/A'}.`,
    },
    historicalPrices,
    historicalEPS,
    historicalDebtToEquity: [],
    historicalPE: [],
  };
}

// ─── ETF data ─────────────────────────────────────────────────────────────────

async function buildETFData(ticker: string): Promise<ETFData> {
  const [summary, historicalPrices] = await Promise.all([
    yahooFinance.quoteSummary(ticker, {
      modules: ['price', 'defaultKeyStatistics', 'topHoldings', 'fundPerformance', 'fundProfile', 'summaryDetail'],
    }) as Promise<any>,
    getHistoricalPrices(ticker),
  ]);

  const price    = summary.price               ?? {};
  const stats    = summary.defaultKeyStatistics ?? {};
  const holdings = summary.topHoldings         ?? {};
  const perf     = summary.fundPerformance      ?? {};
  const prof     = summary.fundProfile          ?? {};

  const fees = prof.feesExpensesInvestment ?? {};
  const expenseRatio = num(fees.annualReportExpenseRatio) || num(fees.netExpenseRatio) || 0.001;

  const inceptionTs = prof.fundInceptionDate;
  const inceptionDate = inceptionTs
    ? new Date(inceptionTs).toISOString().split('T')[0]
    : '2000-01-01';

  const rawHoldings = holdings.holdings ?? [];
  const top10Holdings = rawHoldings.slice(0, 10).map((h: any) => ({
    name:   String(h.holdingName ?? h.symbol ?? ''),
    weight: num(h.holdingPercent),
  }));

  const rawSectors = holdings.sectorWeightings ?? [];
  const sectorAllocations = (rawSectors as any[]).flatMap((obj: any) =>
    Object.entries(obj).map(([sector, weight]) => ({ sector, weight: num(weight) }))
  );

  const trailing = perf.trailingReturns ?? {};
  const oneYearReturn   = num(trailing.oneYear)  || 0;
  const threeYearReturn = num(trailing.threeYear) || 0;
  const fiveYearReturn  = num(trailing.fiveYear)  || 0;
  const tenYearReturn   = num(trailing.tenYear)   || 0;
  const ytdReturn       = num(trailing.ytd)       || 0;

  const annualData = perf.annualTotalReturns?.returns ?? [];
  const annualReturns = (annualData as any[])
    .map((r: any) => ({ year: num(r.year), returnPct: num(r.annualValue) }))
    .filter((r: any) => r.year > 0)
    .sort((a: any, b: any) => a.year - b.year);

  return {
    ticker: ticker.toUpperCase(),
    name:   String(price.longName ?? price.shortName ?? ticker),
    currentPrice: num(price.regularMarketPrice) || num(price.navPrice),
    expenseRatio,
    aum:            num(stats.totalAssets),
    inceptionDate,
    indexTracked:   String(prof.legalType ?? 'Index Fund'),
    numberOfHoldings: num(holdings.numberOfHoldings) || rawHoldings.length || 500,
    dividendYield:  num(stats.yield) || 0,
    trackingError:  0.005,
    top10Holdings,
    sectorAllocations,
    annualReturns,
    ytdReturn,
    oneYearReturn,
    threeYearAnnualizedReturn: threeYearReturn,
    fiveYearAnnualizedReturn:  fiveYearReturn,
    tenYearAnnualizedReturn:   tenYearReturn,
    historicalPrices,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/stock/:ticker', async (req, res) => {
  const key = req.params.ticker.toUpperCase();
  if (fresh(stockCache.get(key))) {
    console.log(`[cache hit] ${key}`);
    return res.json(stockCache.get(key)!.data);
  }
  console.log(`[fetch] ${key} (stock)`);
  try {
    const data = await buildStockData(key);
    stockCache.set(key, { data, ts: Date.now() });
    return res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[stock error] ${key}:`, msg);
    if (/no fundamentals|not found|404|invalid/i.test(msg)) {
      return res.status(404).json({ error: 'invalid_ticker', ticker: key });
    }
    return res.status(500).json({ error: 'fetch_error', message: msg });
  }
});

app.get('/api/etf/:ticker', async (req, res) => {
  const key = req.params.ticker.toUpperCase();
  if (fresh(etfCache.get(key))) {
    console.log(`[cache hit] ${key}`);
    return res.json(etfCache.get(key)!.data);
  }
  console.log(`[fetch] ${key} (etf)`);
  try {
    const data = await buildETFData(key);
    etfCache.set(key, { data, ts: Date.now() });
    return res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[etf error] ${key}:`, msg);
    if (/no fundamentals|not found|404|invalid/i.test(msg)) {
      return res.status(404).json({ error: 'invalid_ticker', ticker: key });
    }
    return res.status(500).json({ error: 'fetch_error', message: msg });
  }
});

app.get('/api/health', async (_req, res) => {
  let internetOk = false;
  let internetError = '';
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    internetOk = r.status < 500;
  } catch (e) {
    internetError = e instanceof Error ? e.message : String(e);
  }
  res.json({ ok: true, source: 'yahoo-finance2', keyRequired: false, internetOk, internetError });
});

const PORT = 3001;
app.listen(PORT, () =>
  console.log(`API server (yahoo-finance2) running on http://localhost:${PORT}`)
);
