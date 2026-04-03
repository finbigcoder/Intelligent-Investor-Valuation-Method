/**
 * Data service — thin HTTP client that calls the Express backend.
 * No API key required; the backend fetches data from Yahoo Finance for free.
 */

import type { StockData, ETFData, AssetType } from '../types';
import { ApiError, InvalidTickerError, DataProcessingError } from './errors';

// Call the Express backend directly. CORS is enabled on the server for localhost:3000.
const BASE = 'http://localhost:3001/api';

// ─── Cache (client-side, mirrors the server's 15-min TTL) ─────────────────────

const CACHE_MS = 15 * 60 * 1000;
interface CacheEntry<T> { data: T; ts: number }
const stockCache = new Map<string, CacheEntry<StockData>>();
const etfCache   = new Map<string, CacheEntry<ETFData>>();
const fresh = <T>(e: CacheEntry<T> | undefined): e is CacheEntry<T> =>
  !!e && Date.now() - e.ts < CACHE_MS;

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiFetch(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch (err) {
    throw new ApiError(
      'Could not reach the data server. Make sure you started it with npm run dev.'
    );
  }

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (res.status === 404 || body.error === 'invalid_ticker') {
    throw new InvalidTickerError(String(body.ticker ?? path));
  }
  if (!res.ok) {
    throw new ApiError(
      `Server error ${res.status}: ${String(body.message ?? body.error ?? 'Unknown error')}`
    );
  }
  return body;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getStockData(ticker: string): Promise<StockData> {
  const key = ticker.toUpperCase();
  if (fresh(stockCache.get(key))) return stockCache.get(key)!.data;

  try {
    const data = await apiFetch(`/stock/${key}`) as StockData;
    if (!data.companyName || !data.currentPrice) {
      throw new DataProcessingError('Incomplete stock data returned by server.');
    }
    stockCache.set(key, { data, ts: Date.now() });
    return data;
  } catch (err) {
    if (
      err instanceof InvalidTickerError ||
      err instanceof DataProcessingError ||
      err instanceof ApiError
    ) throw err;
    throw new ApiError('Unexpected error fetching stock data.');
  }
}

export async function getETFData(ticker: string): Promise<ETFData> {
  const key = ticker.toUpperCase();
  if (fresh(etfCache.get(key))) return etfCache.get(key)!.data;

  try {
    const data = await apiFetch(`/etf/${key}`) as ETFData;
    if (!data.name || !data.currentPrice) {
      throw new DataProcessingError('Incomplete ETF data returned by server.');
    }
    etfCache.set(key, { data, ts: Date.now() });
    return data;
  } catch (err) {
    if (
      err instanceof InvalidTickerError ||
      err instanceof DataProcessingError ||
      err instanceof ApiError
    ) throw err;
    throw new ApiError('Unexpected error fetching ETF data.');
  }
}

export async function fetchAssetData(
  ticker: string,
  assetType: AssetType
): Promise<StockData | ETFData> {
  return assetType === 'etf' ? getETFData(ticker) : getStockData(ticker);
}
