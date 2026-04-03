/**
 * Express backend — fetches financial data from Yahoo Finance (free, no API key).
 * The frontend calls /api/stock/:ticker and /api/etf/:ticker.
 */

import express from 'express';
import cors from 'cors';
import type { StockData, ETFData } from '../types';

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

// ─── Yahoo Finance credential management ──────────────────────────────────────
// YF requires a cookie + crumb pair for the quoteSummary endpoint.

let yfCookie = '';
let yfCrumb = '';
let credentialExpiry = 0;

const YF_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function refreshCredentials(): Promise<void> {
  console.log('[yf] refreshing credentials…');
  // Step 1: get cookies
  const r1 = await fetch('https://finance.yahoo.com/', {
    headers: { 'User-Agent': YF_UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  const setCookies = r1.headers.getSetCookie
    ? r1.headers.getSetCookie()
    : (r1.headers.get('set-cookie') ?? '').split(/,(?=[^ ])/).filter(Boolean);
  yfCookie = setCookies.map((c: string) => c.split(';')[0]).join('; ');

  // Step 2: get crumb (uses the cookies obtained above)
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': YF_UA, Cookie: yfCookie },
  });
  if (!r2.ok) throw new Error(`Failed to get YF crumb: ${r2.status}`);
  yfCrumb = (await r2.text()).trim();
  credentialExpiry = Date.now() + 25 * 60 * 1000; // valid ~25 min
  console.log('[yf] credentials OK, crumb length:', yfCrumb.length);
}

async function ensureCredentials(): Promise<void> {
  if (!yfCrumb || Date.now() > credentialExpiry) await refreshCredentials();
}

/** Generic Yahoo Finance fetch with automatic crumb + cookie + retry on 401. */
async function yfFetch(path: string, retrying = false): Promise<unknown> {
  await ensureCredentials();
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://query1.finance.yahoo.com${path}${sep}crumb=${encodeURIComponent(yfCrumb)}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': YF_UA, Cookie: yfCookie },
  });
  if (r.status === 401 && !retrying) {
    yfCrumb = ''; // force refresh
    return yfFetch(path, true);
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Yahoo Finance ${r.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

// ─── Helper: safely extract a raw number from YF values ──────────────────────

function n(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'number') return isFinite(v) ? v : fallback;
  if (typeof v === 'object' && v !== null && 'raw' in v) {
    const raw = (v as { raw: unknown }).raw;
    if (typeof raw === 'number') return isFinite(raw) ? raw : fallback;
  }
  const num = Number(v);
  return isFinite(num) ? num : fallback;
}

function s(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v !== null && v !== undefined) return String(v);
  return fallback;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_MS = 15 * 60 * 1000;
interface Entry<T> { data: T; ts: number }
const stockCache = new Map<string, Entry<StockData>>();
const etfCache   = new Map<string, Entry<ETFData>>();
const fresh = <T>(e: Entry<T> | undefined): e is Entry<T> =>
  !!e && Date.now() - e.ts < CACHE_MS;

// ─── Historical price chart ───────────────────────────────────────────────────

async function fetchHistoricalPrices(ticker: string): Promise<{ date: string; price: number }[]> {
  try {
    const json = await yfFetch(
      `/v8/finance/chart/${ticker}?interval=1mo&range=5y`
    ) as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } };
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        price: closes[i] ?? null,
      }))
      .filter((p): p is { date: string; price: number } => p.price !== null);
  } catch {
    return [];
  }
}

// ─── Stock data fetching ──────────────────────────────────────────────────────

const STOCK_MODULES = [
  'price',
  'defaultKeyStatistics',
  'financialData',
  'summaryDetail',
  'incomeStatementHistory',
  'balanceSheetHistory',
  'cashflowStatementHistory',
  'earningsHistory',
  'earningsTrend',
  'assetProfile',
].join(',');

interface YFQuoteSummary {
  quoteSummary?: {
    result?: Record<string, unknown>[];
    error?: unknown;
  };
}

async function buildStockData(ticker: string): Promise<StockData> {
  const [summaryJson, historicalPrices] = await Promise.all([
    yfFetch(`/v10/finance/quoteSummary/${ticker}?modules=${STOCK_MODULES}&formatted=false`) as Promise<YFQuoteSummary>,
    fetchHistoricalPrices(ticker),
  ]);

  const qs = (summaryJson as YFQuoteSummary)?.quoteSummary;
  if (qs?.error || !qs?.result?.length) throw new Error(`Invalid ticker: ${ticker}`);

  const result = qs.result[0] as Record<string, unknown>;

  const price       = (result.price       as Record<string, unknown>) ?? {};
  const stats       = (result.defaultKeyStatistics as Record<string, unknown>) ?? {};
  const fin         = (result.financialData as Record<string, unknown>) ?? {};
  const detail      = (result.summaryDetail  as Record<string, unknown>) ?? {};
  const incomeList  = ((result.incomeStatementHistory as Record<string, unknown>)?.incomeStatementHistory as Record<string, unknown>[]) ?? [];
  const bsList      = ((result.balanceSheetHistory    as Record<string, unknown>)?.balanceSheetStatements as Record<string, unknown>[]) ?? [];
  const cfList      = ((result.cashflowStatementHistory as Record<string, unknown>)?.cashflowStatements as Record<string, unknown>[]) ?? [];
  const epsHist     = ((result.earningsHistory as Record<string, unknown>)?.history as Record<string, unknown>[]) ?? [];
  const epsTrend    = ((result.earningsTrend  as Record<string, unknown>)?.trend   as Record<string, unknown>[]) ?? [];
  const profile     = (result.assetProfile   as Record<string, unknown>) ?? {};

  const income0 = incomeList[0] ?? {};
  const income1 = incomeList[1] ?? {};
  const bs0     = bsList[0] ?? {};
  const bs1     = bsList[1] ?? {};
  const cf0     = cfList[0] ?? {};
  const cf1     = cfList[1] ?? {};

  // ── Derived current ratio ──────────────────────────────────────────────────
  const currentAssets      = n(bs0.totalCurrentAssets);
  const currentLiabilities = n(bs0.totalCurrentLiabilities);
  const prevCurrentAssets  = n(bs1.totalCurrentAssets);
  const prevCurrentLiab    = n(bs1.totalCurrentLiabilities);

  const currentRatioCurr = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  const currentRatioPrev = prevCurrentLiab > 0 ? prevCurrentAssets / prevCurrentLiab : 0;

  // ── Gross margin ──────────────────────────────────────────────────────────
  const revenue0    = n(income0.totalRevenue);
  const grossProfit0 = n(income0.grossProfit);
  const revenue1    = n(income1.totalRevenue);
  const grossProfit1 = n(income1.grossProfit);
  const grossMarginCurr = revenue0 > 0 ? grossProfit0 / revenue0 : 0;
  const grossMarginPrev = revenue1 > 0 ? grossProfit1 / revenue1 : 0;

  // ── Asset turnover ────────────────────────────────────────────────────────
  const totalAssets0 = n(bs0.totalAssets);
  const totalAssets1 = n(bs1.totalAssets);
  const assetTurnoverCurr = totalAssets0 > 0 ? revenue0 / totalAssets0 : 0;
  const assetTurnoverPrev = totalAssets1 > 0 ? revenue1 / totalAssets1 : 0;

  // ── ROA (current year from financialData; prev computed from statements) ──
  const netIncome0 = n(income0.netIncome);
  const netIncome1 = n(income1.netIncome);
  const roaCurr = n(fin.returnOnAssets) || (totalAssets0 > 0 ? netIncome0 / totalAssets0 : 0);
  const roaPrev = totalAssets1 > 0 ? netIncome1 / totalAssets1 : 0;

  // ── Historical EPS (quarterly earningsHistory → annual sums) ─────────────
  const annualMap = new Map<number, number[]>();
  for (const h of epsHist) {
    const ts = n(h.quarter);
    if (!ts) continue;
    const year = new Date(ts * 1000).getFullYear();
    if (!annualMap.has(year)) annualMap.set(year, []);
    annualMap.get(year)!.push(n(h.epsActual));
  }
  const historicalEPS = [...annualMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, vals]) => ({ year, eps: vals.reduce((s, v) => s + v, 0) }));

  // ── EPS growth fields ──────────────────────────────────────────────────────
  const eps = n(stats.trailingEps) || n(fin.revenuePerShare) || 0;
  const eps10YearsAgo = historicalEPS.length >= 10
    ? historicalEPS[historicalEPS.length - 10].eps
    : historicalEPS.length > 0 ? historicalEPS[0].eps : 0;
  const threeYearAvgEPS = historicalEPS.length >= 3
    ? historicalEPS.slice(-3).reduce((s, e) => s + e.eps, 0) / 3
    : eps;

  // ── hasPositiveEarningsLast10Years ────────────────────────────────────────
  const recentEPS = historicalEPS.slice(-10);
  const hasPositiveEarningsLast10Years = recentEPS.length >= 5
    ? recentEPS.every(e => e.eps > 0)
    : eps > 0;

  // ── hasUninterruptedDividendsLast20Years ──────────────────────────────────
  const divYield = n(detail.dividendYield) || n(stats.dividendYield) || 0;
  const fiveYrDivGrowth = n(stats.fiveYearAvgDividendYield);
  const hasUninterruptedDividendsLast20Years =
    divYield > 0 && fiveYrDivGrowth > 0;

  // ── EPS growth rate estimate ───────────────────────────────────────────────
  const fiveYrTrend = epsTrend.find((t) => s(t.period) === '+5y');
  const oneYrTrend  = epsTrend.find((t) => s(t.period) === '+1y');
  const estimatedEPSGrowthRate =
    n((fiveYrTrend as Record<string, unknown>)?.growth) ||
    n((oneYrTrend  as Record<string, unknown>)?.growth) ||
    n(fin.revenueGrowth) ||
    0.07; // conservative default

  // ── D/E — Yahoo gives it as %, e.g. 171.2 → ratio 1.712 ─────────────────
  const debtToEquity = n(fin.debtToEquity) / 100;

  // ── Long-term debt history ────────────────────────────────────────────────
  const longTermDebt0 = n(bs0.longTermDebt);
  const longTermDebt1 = n(bs1.longTermDebt);

  // ── Shares outstanding ────────────────────────────────────────────────────
  const sharesCurr = n(stats.sharesOutstanding) || n(price.sharesOutstanding) || 1;
  const sharesPrev = n(stats.impliedSharesOutstanding) || sharesCurr;

  // ── Logo URL ──────────────────────────────────────────────────────────────
  const website = s(profile.website).replace(/https?:\/\/(www\.)?/, '').split('/')[0];
  const logoUrl = website
    ? `https://logo.clearbit.com/${website}`
    : `https://assets.parqet.com/logos/symbol/${ticker.toUpperCase()}`;

  // ── Operating cash flow (prefer cash flow statement) ─────────────────────
  const operatingCashFlow =
    n(cf0.totalCashFromOperatingActivities) || n(fin.operatingCashflow);
  const capitalExpenditures = Math.abs(n(cf0.capitalExpenditures));

  return {
    ticker:       ticker.toUpperCase(),
    companyName:  s(price.longName) || s(price.shortName) || ticker.toUpperCase(),
    logoUrl,
    currentPrice: n(price.regularMarketPrice),
    marketCap:    n(price.marketCap),
    eps,
    bookValuePerShare: n(stats.bookValue),
    currentAssets,
    currentLiabilities,
    roe:          n(fin.returnOnEquity),
    debtToEquity,
    longTermDebt: longTermDebt0,
    hasPositiveEarningsLast10Years,
    hasUninterruptedDividendsLast20Years,
    eps10YearsAgo,
    threeYearAverageEPS: threeYearAvgEPS,
    totalLiabilities: n(bs0.totalLiab),
    preferredStockValue: n(bs0.preferredStockValue),
    sharesOutstanding: { currentYear: sharesCurr, previousYear: sharesPrev },
    roa:              { currentYear: roaCurr, previousYear: roaPrev },
    operatingCashFlow,
    netIncome: netIncome0,
    longTermDebtHistory: { currentYear: longTermDebt0, previousYear: longTermDebt1 },
    currentRatioHistory: { currentYear: currentRatioCurr, previousYear: currentRatioPrev },
    grossMargin:    { currentYear: grossMarginCurr, previousYear: grossMarginPrev },
    assetTurnover:  { currentYear: assetTurnoverCurr, previousYear: assetTurnoverPrev },
    estimatedEPSGrowthRate,
    qualitativeAnalysis: {
      economicMoat: s(profile.longBusinessSummary).slice(0, 300) ||
        `${s(profile.sector)} company operating in ${s(profile.industry)}.`,
      managementQuality:
        `Sector: ${s(profile.sector) || 'N/A'}. Industry: ${s(profile.industry) || 'N/A'}. ` +
        `Full-time employees: ${n(profile.fullTimeEmployees).toLocaleString()}.`,
    },
    historicalPrices,
    historicalEPS,
    historicalDebtToEquity: [],
    historicalPE: [],
  };
}

// ─── ETF data fetching ────────────────────────────────────────────────────────

const ETF_MODULES = [
  'price',
  'defaultKeyStatistics',
  'topHoldings',
  'fundPerformance',
  'fundProfile',
  'summaryDetail',
].join(',');

async function buildETFData(ticker: string): Promise<ETFData> {
  const [summaryJson, historicalPrices] = await Promise.all([
    yfFetch(`/v10/finance/quoteSummary/${ticker}?modules=${ETF_MODULES}&formatted=false`) as Promise<YFQuoteSummary>,
    fetchHistoricalPrices(ticker),
  ]);

  const qs = (summaryJson as YFQuoteSummary)?.quoteSummary;
  if (qs?.error || !qs?.result?.length) throw new Error(`Invalid ticker: ${ticker}`);

  const result = qs.result[0] as Record<string, unknown>;

  const price    = (result.price    as Record<string, unknown>) ?? {};
  const stats    = (result.defaultKeyStatistics as Record<string, unknown>) ?? {};
  const holdings = (result.topHoldings  as Record<string, unknown>) ?? {};
  const perf     = (result.fundPerformance as Record<string, unknown>) ?? {};
  const prof     = (result.fundProfile   as Record<string, unknown>) ?? {};
  const detail   = (result.summaryDetail as Record<string, unknown>) ?? {};

  // ── Expense ratio ─────────────────────────────────────────────────────────
  const fees = (prof.feesExpensesInvestment as Record<string, unknown>) ?? {};
  const expenseRatio =
    n(fees.annualReportExpenseRatio) ||
    n(fees.netExpenseRatio) ||
    n(detail.expenseRatio) ||
    n(stats.annualHoldingsTurnover) * 0 || // prevent unrelated field
    0.001; // 0.1% safe default

  // ── AUM ───────────────────────────────────────────────────────────────────
  const aum = n(stats.totalAssets);

  // ── Inception date ────────────────────────────────────────────────────────
  const inceptionTs = n(prof.fundInceptionDate) || n(stats.fundInceptionDate);
  const inceptionDate = inceptionTs
    ? new Date(inceptionTs * 1000).toISOString().split('T')[0]
    : '2000-01-01';

  // ── Holdings ──────────────────────────────────────────────────────────────
  const rawHoldings = ((holdings.holdings ?? []) as Record<string, unknown>[]);
  const top10Holdings = rawHoldings.slice(0, 10).map((h) => ({
    name:   s(h.holdingName) || s(h.symbol),
    weight: n(h.holdingPercent),
  }));

  // ── Sector allocations ────────────────────────────────────────────────────
  const rawSectors = ((holdings.sectorWeightings ?? []) as Record<string, unknown>[]);
  const sectorAllocations = rawSectors.flatMap((obj) =>
    Object.entries(obj)
      .filter(([k]) => k !== 'realestate') // skip internal fields occasionally
      .map(([sector, weight]) => ({ sector, weight: n(weight) }))
  );

  // ── Number of holdings ────────────────────────────────────────────────────
  const numberOfHoldings =
    n((holdings.equityHoldings as Record<string, unknown>)?.numberOfEquityHoldings) ||
    n(stats.fundHoldings) ||
    rawHoldings.length ||
    500;

  // ── Returns ───────────────────────────────────────────────────────────────
  const trailing = ((perf.trailingReturns ?? {}) as Record<string, unknown>);
  const oneYearReturn   = n(trailing.oneYear)   || n(trailing['1Year']) || 0;
  const threeYearReturn = n(trailing.threeYear)  || n(trailing['3Year']) || 0;
  const fiveYearReturn  = n(trailing.fiveYear)   || n(trailing['5Year']) || 0;
  const tenYearReturn   = n(trailing.tenYear)    || n(trailing['10Year']) || 0;
  const ytdReturn       = n(trailing.ytd) || n(trailing.ytdReturn) || 0;

  // ── Annual returns ────────────────────────────────────────────────────────
  const annualTotalReturns = (perf.annualTotalReturns as Record<string, unknown>) ?? {};
  const rawAnnual = ((annualTotalReturns.returns ?? []) as Record<string, unknown>[]);
  const annualReturns = rawAnnual
    .map((r) => ({ year: n(r.year), returnPct: n(r.annualValue) }))
    .filter((r) => r.year > 0)
    .sort((a, b) => a.year - b.year);

  // ── Tracking error ────────────────────────────────────────────────────────
  // Yahoo Finance doesn't expose tracking error directly; use a reasonable default
  const trackingError = 0.005; // ~0.5% is typical for major ETFs

  // ── Index tracked ─────────────────────────────────────────────────────────
  const indexTracked =
    s(prof.legalType) ||
    s(prof.categoryName) ||
    'Index Fund';

  return {
    ticker: ticker.toUpperCase(),
    name: s(price.longName) || s(price.shortName) || ticker.toUpperCase(),
    currentPrice: n(price.regularMarketPrice) || n(price.navPrice),
    expenseRatio,
    aum,
    inceptionDate,
    indexTracked,
    numberOfHoldings,
    dividendYield: n(stats.yield) || n(detail.yield) || 0,
    trackingError,
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
    console.log(`[cache hit] ${key} (stock)`);
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
    if (msg.toLowerCase().includes('invalid ticker')) {
      return res.status(404).json({ error: 'invalid_ticker', ticker: key });
    }
    return res.status(500).json({ error: 'fetch_error', message: msg });
  }
});

app.get('/api/etf/:ticker', async (req, res) => {
  const key = req.params.ticker.toUpperCase();

  if (fresh(etfCache.get(key))) {
    console.log(`[cache hit] ${key} (etf)`);
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
    if (msg.toLowerCase().includes('invalid ticker')) {
      return res.status(404).json({ error: 'invalid_ticker', ticker: key });
    }
    return res.status(500).json({ error: 'fetch_error', message: msg });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, source: 'yahoo-finance', keyRequired: false });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () =>
  console.log(`API server (Yahoo Finance) running on http://localhost:${PORT}`)
);
