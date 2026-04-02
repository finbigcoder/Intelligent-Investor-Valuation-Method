import { GoogleGenAI } from '@google/genai';
import type { StockData, ETFData, AssetType } from '../types';
import { ApiError, InvalidTickerError, DataProcessingError } from './errors';

if (!process.env.API_KEY) {
  throw new Error('API_KEY environment variable is not set');
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const stockCache = new Map<string, CacheEntry<StockData>>();
const etfCache = new Map<string, CacheEntry<ETFData>>();

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < CACHE_DURATION_MS;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  const text = raw.trim();
  // Strip markdown code fence if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

function assertPresent(data: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null) {
      throw new DataProcessingError(`Missing required field "${field}" in API response.`);
    }
  }
}

// ─── Stock data fetch ─────────────────────────────────────────────────────────

const STOCK_SYSTEM_INSTRUCTION = `You are a meticulous financial analyst AI. Your sole task is to retrieve and structure a comprehensive set of financial data points for a given stock ticker. Use your search tool to find the most current and accurate values, prioritising official sources like SEC filings (10-K, 10-Q) and top-tier financial outlets (Bloomberg, Reuters, Yahoo Finance). Your final output must be ONLY the raw, minified JSON object requested. Do not include any introductory text, explanations, or markdown formatting.`;

function buildStockPrompt(ticker: string): string {
  return `Analyse the stock ticker "${ticker}" and return a single, minified JSON object with the following schema. All fields are mandatory. If the ticker is invalid or you cannot confidently find all required data, return {"ticker":"${ticker}","error":"Invalid Ticker or insufficient data"}.

JSON schema:
{
  "ticker": "string",
  "companyName": "string",
  "logoUrl": "string",
  "currentPrice": "number",
  "marketCap": "number",
  "eps": "number (TTM)",
  "bookValuePerShare": "number",
  "currentAssets": "number",
  "currentLiabilities": "number",
  "roe": "number (decimal)",
  "debtToEquity": "number",
  "longTermDebt": "number",
  "hasPositiveEarningsLast10Years": "boolean",
  "hasUninterruptedDividendsLast20Years": "boolean",
  "eps10YearsAgo": "number",
  "threeYearAverageEPS": "number",
  "totalLiabilities": "number",
  "preferredStockValue": "number",
  "operatingCashFlow": "number",
  "netIncome": "number",
  "capitalExpenditures": "number",
  "estimatedEPSGrowthRate": "number (5-year forward estimate, decimal)",
  "sharesOutstanding": {"currentYear": "number", "previousYear": "number"},
  "roa": {"currentYear": "number (decimal)", "previousYear": "number (decimal)"},
  "longTermDebtHistory": {"currentYear": "number", "previousYear": "number"},
  "currentRatioHistory": {"currentYear": "number", "previousYear": "number"},
  "grossMargin": {"currentYear": "number (decimal)", "previousYear": "number (decimal)"},
  "assetTurnover": {"currentYear": "number", "previousYear": "number"},
  "qualitativeAnalysis": {
    "economicMoat": "string (1-2 sentences)",
    "managementQuality": "string (1-2 sentences)"
  },
  "historicalPrices": [{"date": "YYYY-MM-DD", "price": "number"}],
  "historicalEPS": [{"year": "number", "eps": "number"}],
  "historicalDebtToEquity": [{"year": "number", "ratio": "number"}],
  "historicalPE": [{"year": "number", "ratio": "number"}]
}`;
}

export async function getStockData(ticker: string): Promise<StockData> {
  const key = ticker.toUpperCase();

  const cached = stockCache.get(key);
  if (isFresh(cached)) {
    console.log(`[cache hit] ${key} (stock)`);
    return cached.data;
  }

  console.log(`[fetch] ${key} (stock)`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ text: buildStockPrompt(ticker) }],
      config: {
        systemInstruction: STOCK_SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });

    const data = extractJson(response.text) as Record<string, unknown>;

    if (data.error) {
      throw new InvalidTickerError(key);
    }

    const requiredFields = [
      'companyName', 'currentPrice', 'marketCap', 'eps', 'bookValuePerShare',
      'currentAssets', 'currentLiabilities', 'roe', 'debtToEquity', 'longTermDebt',
      'hasPositiveEarningsLast10Years', 'hasUninterruptedDividendsLast20Years',
      'eps10YearsAgo', 'threeYearAverageEPS', 'totalLiabilities', 'preferredStockValue',
      'operatingCashFlow', 'netIncome', 'capitalExpenditures', 'estimatedEPSGrowthRate',
      'sharesOutstanding', 'roa', 'longTermDebtHistory', 'currentRatioHistory',
      'grossMargin', 'assetTurnover', 'qualitativeAnalysis', 'historicalPrices',
      'historicalEPS',
    ];
    assertPresent(data, requiredFields);

    const nested = data as {
      sharesOutstanding: { currentYear: unknown };
      roa: { currentYear: unknown };
      qualitativeAnalysis: { economicMoat: unknown };
    };
    if (
      typeof nested.sharesOutstanding.currentYear !== 'number' ||
      typeof nested.roa.currentYear !== 'number' ||
      typeof nested.qualitativeAnalysis.economicMoat !== 'string'
    ) {
      throw new DataProcessingError('Invalid nested data types received from API.');
    }

    // Sort historical arrays chronologically for charts
    const arr = data as Record<string, { date?: string; year?: number }[]>;
    if (Array.isArray(arr.historicalPrices)) {
      arr.historicalPrices.sort((a, b) =>
        new Date(a.date!).getTime() - new Date(b.date!).getTime()
      );
    }
    for (const key of ['historicalEPS', 'historicalDebtToEquity', 'historicalPE']) {
      if (Array.isArray(arr[key])) {
        arr[key].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      }
    }

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    const result = { ...data, groundingChunks } as StockData;
    stockCache.set(key, { data: result, timestamp: Date.now() });
    console.log(`[cached] ${key} (stock)`);

    return result;
  } catch (err) {
    if (err instanceof InvalidTickerError || err instanceof DataProcessingError) throw err;
    if (err instanceof SyntaxError) {
      throw new DataProcessingError('Received malformed JSON from the financial service.');
    }
    throw new ApiError('Failed to fetch or process stock data from the generative model.');
  }
}

// ─── ETF data fetch ───────────────────────────────────────────────────────────

const ETF_SYSTEM_INSTRUCTION = `You are a meticulous financial analyst AI specialising in exchange-traded funds. Your sole task is to retrieve and structure comprehensive data for a given ETF ticker. Use your search tool to find the most current and accurate values from the fund provider's official fact-sheet, Bloomberg, Morningstar, or ETFdb.com. Your final output must be ONLY the raw, minified JSON object requested. Do not include any introductory text, explanations, or markdown formatting.`;

function buildETFPrompt(ticker: string): string {
  return `Analyse the ETF ticker "${ticker}" and return a single, minified JSON object with the following schema. All fields are mandatory. If the ticker is not a valid ETF or you cannot confidently find all required data, return {"ticker":"${ticker}","error":"Invalid ETF ticker or insufficient data"}.

JSON schema:
{
  "ticker": "string",
  "name": "string (full fund name)",
  "currentPrice": "number (NAV in USD)",
  "expenseRatio": "number (annual fee as decimal, e.g. 0.0003 for 0.03%)",
  "aum": "number (total assets in USD)",
  "inceptionDate": "string (YYYY-MM-DD)",
  "indexTracked": "string (name of benchmark index)",
  "numberOfHoldings": "number",
  "dividendYield": "number (as decimal)",
  "trackingError": "number (annualised std dev vs benchmark, as decimal)",
  "top10Holdings": [{"name": "string", "weight": "number (decimal)"}],
  "sectorAllocations": [{"sector": "string", "weight": "number (decimal)"}],
  "annualReturns": [{"year": "number", "returnPct": "number (decimal)"}],
  "ytdReturn": "number (decimal)",
  "oneYearReturn": "number (decimal)",
  "threeYearAnnualizedReturn": "number (decimal)",
  "fiveYearAnnualizedReturn": "number (decimal)",
  "tenYearAnnualizedReturn": "number (decimal, 0 if fund is younger than 10 years)",
  "historicalPrices": [{"date": "YYYY-MM-DD", "price": "number"}]
}`;
}

export async function getETFData(ticker: string): Promise<ETFData> {
  const key = ticker.toUpperCase();

  const cached = etfCache.get(key);
  if (isFresh(cached)) {
    console.log(`[cache hit] ${key} (etf)`);
    return cached.data;
  }

  console.log(`[fetch] ${key} (etf)`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ text: buildETFPrompt(ticker) }],
      config: {
        systemInstruction: ETF_SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });

    const data = extractJson(response.text) as Record<string, unknown>;

    if (data.error) {
      throw new InvalidTickerError(key);
    }

    const requiredFields = [
      'name', 'currentPrice', 'expenseRatio', 'aum', 'inceptionDate',
      'indexTracked', 'numberOfHoldings', 'dividendYield', 'trackingError',
      'top10Holdings', 'sectorAllocations', 'annualReturns',
      'ytdReturn', 'oneYearReturn', 'threeYearAnnualizedReturn',
      'fiveYearAnnualizedReturn', 'tenYearAnnualizedReturn', 'historicalPrices',
    ];
    assertPresent(data, requiredFields);

    // Sort historical prices chronologically
    const arr = data as Record<string, { date?: string }[]>;
    if (Array.isArray(arr.historicalPrices)) {
      arr.historicalPrices.sort((a, b) =>
        new Date(a.date!).getTime() - new Date(b.date!).getTime()
      );
    }

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    const result = { ticker: key, ...data, groundingChunks } as ETFData;
    etfCache.set(key, { data: result, timestamp: Date.now() });
    console.log(`[cached] ${key} (etf)`);

    return result;
  } catch (err) {
    if (err instanceof InvalidTickerError || err instanceof DataProcessingError) throw err;
    if (err instanceof SyntaxError) {
      throw new DataProcessingError('Received malformed JSON from the financial service.');
    }
    throw new ApiError('Failed to fetch or process ETF data from the generative model.');
  }
}

// ─── Unified entry point ──────────────────────────────────────────────────────

export async function fetchAssetData(
  ticker: string,
  assetType: AssetType
): Promise<StockData | ETFData> {
  return assetType === 'etf' ? getETFData(ticker) : getStockData(ticker);
}
