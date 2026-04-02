/**
 * AI service — uses Claude (claude-opus-4-6) with the web_search server-side
 * tool to retrieve real-time financial data for stocks and ETFs.
 *
 * The web_search tool runs entirely on Anthropic's servers; we just handle the
 * pause_turn continuation loop and extract the final JSON from Claude's reply.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { StockData, ETFData, AssetType } from '../types';
import { ApiError, InvalidTickerError, DataProcessingError } from './errors';

// ─── Client ───────────────────────────────────────────────────────────────────

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ApiError(
      'No Anthropic API key found. Add ANTHROPIC_API_KEY to your .env file and restart the dev server.'
    );
  }
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Required for browser environments (Vite inlines the key at build time)
    dangerouslyAllowBrowser: true,
  });
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const stockCache = new Map<string, CacheEntry<StockData>>();
const etfCache   = new Map<string, CacheEntry<ETFData>>();

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < CACHE_DURATION_MS;
}

// ─── Core Claude call ─────────────────────────────────────────────────────────

/**
 * Calls Claude with the web_search server-side tool.
 * Handles the pause_turn loop that fires when the server-side tool needs more
 * iterations to gather all the required data.
 */
async function callClaude(system: string, user: string): Promise<string> {
  const client = getClient();
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: user }];

  const MAX_CONTINUATIONS = 8; // safety cap
  for (let i = 0; i < MAX_CONTINUATIONS; i++) {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      system,
      // web_search_20260209 supports dynamic filtering on Opus 4.6 — no beta
      // header required. Do not type-annotate tools as Tool[] (that is only for
      // user-defined tools); let TypeScript infer from the parameter.
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      if (!text.trim()) throw new DataProcessingError('Claude returned an empty response.');
      return text;
    }

    if (response.stop_reason === 'pause_turn') {
      // Append assistant turn and re-send so the server continues from where it
      // left off. Do NOT add an extra user message — the API detects the
      // trailing server_tool_use block automatically.
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }

    // Unexpected stop (e.g. max_tokens) — return whatever text is available
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (text.trim()) return text;
    throw new ApiError(`Unexpected stop reason: ${response.stop_reason}`);
  }

  throw new ApiError('Claude did not produce a final response within the allowed continuations.');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  const text = raw.trim();
  // Strip markdown code fences if Claude wraps the JSON
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

function assertPresent(data: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null) {
      throw new DataProcessingError(`Missing required field "${field}" in Claude's response.`);
    }
  }
}

// ─── Stock prompts ────────────────────────────────────────────────────────────

const STOCK_SYSTEM = `You are a meticulous financial analyst. Your task is to search the web and retrieve comprehensive, up-to-date financial data for a given stock ticker, then return it as a single minified JSON object matching the requested schema exactly.

Rules:
1. Search for official data first: SEC filings (10-K, 10-Q), then top-tier sources (Bloomberg, Reuters, Yahoo Finance, Macrotrends).
2. All numeric fields must be actual numbers, not strings.
3. Your FINAL output must be ONLY the raw JSON — no explanation, no markdown, no preamble.
4. If the ticker is invalid or you cannot find sufficient data, return {"ticker":"...","error":"Invalid ticker or insufficient data"}.`;

function buildStockPrompt(ticker: string): string {
  return `Search for comprehensive financial data for the stock ticker "${ticker}" and return a single minified JSON object matching this schema exactly. All fields are required.

{"ticker":"string","companyName":"string","logoUrl":"string","currentPrice":"number","marketCap":"number","eps":"number (TTM)","bookValuePerShare":"number","currentAssets":"number","currentLiabilities":"number","roe":"number (decimal)","debtToEquity":"number","longTermDebt":"number","hasPositiveEarningsLast10Years":"boolean","hasUninterruptedDividendsLast20Years":"boolean","eps10YearsAgo":"number","threeYearAverageEPS":"number","totalLiabilities":"number","preferredStockValue":"number","operatingCashFlow":"number","netIncome":"number","capitalExpenditures":"number","estimatedEPSGrowthRate":"number (5-year forward, decimal)","sharesOutstanding":{"currentYear":"number","previousYear":"number"},"roa":{"currentYear":"number (decimal)","previousYear":"number (decimal)"},"longTermDebtHistory":{"currentYear":"number","previousYear":"number"},"currentRatioHistory":{"currentYear":"number","previousYear":"number"},"grossMargin":{"currentYear":"number (decimal)","previousYear":"number (decimal)"},"assetTurnover":{"currentYear":"number","previousYear":"number"},"qualitativeAnalysis":{"economicMoat":"string (1-2 sentences)","managementQuality":"string (1-2 sentences)"},"historicalPrices":[{"date":"YYYY-MM-DD","price":"number"}],"historicalEPS":[{"year":"number","eps":"number"}],"historicalDebtToEquity":[{"year":"number","ratio":"number"}],"historicalPE":[{"year":"number","ratio":"number"}]}`;
}

// ─── ETF prompts ──────────────────────────────────────────────────────────────

const ETF_SYSTEM = `You are a meticulous financial analyst specialising in ETFs and index funds. Search the web and retrieve comprehensive data for a given ETF ticker from the fund provider's fact-sheet, Morningstar, ETFdb.com, or Bloomberg. Return the data as a single minified JSON object.

Rules:
1. All numeric fields must be actual numbers (decimals for ratios/percentages, e.g. 0.0003 not "0.03%").
2. Your FINAL output must be ONLY the raw JSON — no explanation, no markdown, no preamble.
3. If the ticker is not a valid ETF, return {"ticker":"...","error":"Invalid ETF ticker or insufficient data"}.`;

function buildETFPrompt(ticker: string): string {
  return `Search for comprehensive data for the ETF ticker "${ticker}" and return a single minified JSON object matching this schema exactly. All fields are required.

{"ticker":"string","name":"string (full fund name)","currentPrice":"number (NAV in USD)","expenseRatio":"number (annual fee as decimal, e.g. 0.0003 for 0.03%)","aum":"number (total assets in USD)","inceptionDate":"string (YYYY-MM-DD)","indexTracked":"string","numberOfHoldings":"number","dividendYield":"number (decimal)","trackingError":"number (annualised std dev vs benchmark, decimal)","top10Holdings":[{"name":"string","weight":"number (decimal)"}],"sectorAllocations":[{"sector":"string","weight":"number (decimal)"}],"annualReturns":[{"year":"number","returnPct":"number (decimal)"}],"ytdReturn":"number (decimal)","oneYearReturn":"number (decimal)","threeYearAnnualizedReturn":"number (decimal)","fiveYearAnnualizedReturn":"number (decimal)","tenYearAnnualizedReturn":"number (decimal, 0 if fund younger than 10 years)","historicalPrices":[{"date":"YYYY-MM-DD","price":"number"}]}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getStockData(ticker: string): Promise<StockData> {
  const key = ticker.toUpperCase();

  if (isFresh(stockCache.get(key))) {
    console.log(`[cache hit] ${key} (stock)`);
    return stockCache.get(key)!.data;
  }

  console.log(`[fetch] ${key} (stock)`);

  try {
    const raw = await callClaude(STOCK_SYSTEM, buildStockPrompt(ticker));
    const data = extractJson(raw) as Record<string, unknown>;

    if (data.error) throw new InvalidTickerError(key);

    assertPresent(data, [
      'companyName', 'currentPrice', 'marketCap', 'eps', 'bookValuePerShare',
      'currentAssets', 'currentLiabilities', 'roe', 'debtToEquity', 'longTermDebt',
      'hasPositiveEarningsLast10Years', 'hasUninterruptedDividendsLast20Years',
      'eps10YearsAgo', 'threeYearAverageEPS', 'totalLiabilities', 'preferredStockValue',
      'operatingCashFlow', 'netIncome', 'capitalExpenditures', 'estimatedEPSGrowthRate',
      'sharesOutstanding', 'roa', 'longTermDebtHistory', 'currentRatioHistory',
      'grossMargin', 'assetTurnover', 'qualitativeAnalysis',
      'historicalPrices', 'historicalEPS',
    ]);

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
      throw new DataProcessingError('Invalid nested data types in Claude response.');
    }

    // Sort historical arrays chronologically for chart rendering
    const arr = data as Record<string, { date?: string; year?: number }[]>;
    if (Array.isArray(arr.historicalPrices)) {
      arr.historicalPrices.sort((a, b) =>
        new Date(a.date!).getTime() - new Date(b.date!).getTime()
      );
    }
    for (const k of ['historicalEPS', 'historicalDebtToEquity', 'historicalPE']) {
      if (Array.isArray(arr[k])) {
        arr[k].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      }
    }

    const result = { ...data } as StockData;
    stockCache.set(key, { data: result, timestamp: Date.now() });
    console.log(`[cached] ${key} (stock)`);
    return result;

  } catch (err) {
    if (err instanceof InvalidTickerError || err instanceof DataProcessingError) throw err;
    if (err instanceof SyntaxError) {
      throw new DataProcessingError('Received malformed JSON from Claude.');
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError('Unexpected error fetching stock data.');
  }
}

export async function getETFData(ticker: string): Promise<ETFData> {
  const key = ticker.toUpperCase();

  if (isFresh(etfCache.get(key))) {
    console.log(`[cache hit] ${key} (etf)`);
    return etfCache.get(key)!.data;
  }

  console.log(`[fetch] ${key} (etf)`);

  try {
    const raw = await callClaude(ETF_SYSTEM, buildETFPrompt(ticker));
    const data = extractJson(raw) as Record<string, unknown>;

    if (data.error) throw new InvalidTickerError(key);

    assertPresent(data, [
      'name', 'currentPrice', 'expenseRatio', 'aum', 'inceptionDate',
      'indexTracked', 'numberOfHoldings', 'dividendYield', 'trackingError',
      'top10Holdings', 'sectorAllocations', 'annualReturns',
      'ytdReturn', 'oneYearReturn', 'threeYearAnnualizedReturn',
      'fiveYearAnnualizedReturn', 'tenYearAnnualizedReturn', 'historicalPrices',
    ]);

    // Sort prices chronologically
    const arr = data as Record<string, { date?: string }[]>;
    if (Array.isArray(arr.historicalPrices)) {
      arr.historicalPrices.sort((a, b) =>
        new Date(a.date!).getTime() - new Date(b.date!).getTime()
      );
    }

    const result = { ticker: key, ...data } as ETFData;
    etfCache.set(key, { data: result, timestamp: Date.now() });
    console.log(`[cached] ${key} (etf)`);
    return result;

  } catch (err) {
    if (err instanceof InvalidTickerError || err instanceof DataProcessingError) throw err;
    if (err instanceof SyntaxError) {
      throw new DataProcessingError('Received malformed JSON from Claude.');
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError('Unexpected error fetching ETF data.');
  }
}

export async function fetchAssetData(
  ticker: string,
  assetType: AssetType
): Promise<StockData | ETFData> {
  return assetType === 'etf' ? getETFData(ticker) : getStockData(ticker);
}
