

import { useState, useEffect, useCallback } from 'react';
import type { ValuationResult, HistoryEntry } from '../types';

const STORAGE_KEY = 'stockValuationHistory';

export const useHistory = (): [HistoryEntry[], (result: ValuationResult) => void, () => void] => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(STORAGE_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Failed to parse history from localStorage", error);
    }
  }, []);

  const saveHistory = (newHistory: HistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.error("Failed to save history to localStorage", error);
    }
  };

  const addHistoryEntry = useCallback((result: ValuationResult) => {
    const newEntry: HistoryEntry = {
      // FIX: Access nested properties from the result object to build the history entry.
      ticker: result.stockData.ticker,
      companyName: result.stockData.companyName,
      valuationDate: new Date().toISOString(),
      recommendation: result.summary.recommendation,
      intrinsicValue: result.valuation.grahamNumber,
    };
    // Add to the beginning of the list and limit history size to 50 entries
    const updatedHistory = [newEntry, ...history].slice(0, 50); 
    saveHistory(updatedHistory);
  }, [history]);

  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, []);

  return [history, addHistoryEntry, clearHistory];
};