import { useState, useEffect, useCallback } from 'react';
import type { AnyValuationResult, HistoryEntry } from '../types';

const STORAGE_KEY = 'stockValuationHistory';
const MAX_ENTRIES = 50;

export const useHistory = (): [
  HistoryEntry[],
  (result: AnyValuationResult) => void,
  () => void
] => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      console.error('Failed to parse history from localStorage');
    }
  }, []);

  const saveHistory = (next: HistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setHistory(next);
    } catch {
      console.error('Failed to save history to localStorage');
    }
  };

  const addHistoryEntry = useCallback(
    (result: AnyValuationResult) => {
      let entry: HistoryEntry;

      if (result.assetType === 'etf') {
        entry = {
          ticker: result.etfData.ticker,
          companyName: result.etfData.name,
          assetType: 'etf',
          valuationDate: new Date().toISOString(),
          recommendation: result.summary.recommendation,
          intrinsicValue: 0,
        };
      } else {
        entry = {
          ticker: result.stockData.ticker,
          companyName: result.stockData.companyName,
          assetType: 'stock',
          valuationDate: new Date().toISOString(),
          recommendation: result.summary.recommendation,
          intrinsicValue: result.valuation.grahamNumber,
        };
      }

      const updated = [entry, ...history].slice(0, MAX_ENTRIES);
      saveHistory(updated);
    },
    [history]
  );

  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, []);

  return [history, addHistoryEntry, clearHistory];
};
