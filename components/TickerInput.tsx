import React, { useState } from 'react';
import type { AssetType } from '../types';

interface TickerInputProps {
  onValuate: (ticker: string, assetType: AssetType) => void;
  isLoading: boolean;
}

const STOCK_EXAMPLES = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'KO'];
const ETF_EXAMPLES = ['SPY', 'QQQ', 'VTI', 'SCHB', 'IVV'];

const TickerInput: React.FC<TickerInputProps> = ({ onValuate, isLoading }) => {
  const [ticker, setTicker] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('stock');

  const examples = assetType === 'stock' ? STOCK_EXAMPLES : ETF_EXAMPLES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = ticker.trim().toUpperCase();
    if (clean) {
      onValuate(clean, assetType);
      setTicker('');
    }
  };

  const handleExampleClick = (example: string) => {
    onValuate(example, assetType);
  };

  const placeholder =
    assetType === 'stock'
      ? 'Enter stock ticker (e.g., GOOGL)'
      : 'Enter ETF ticker (e.g., SPY)';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Asset type toggle */}
      <div className="flex justify-center mb-5" role="group" aria-label="Asset type selector">
        <button
          type="button"
          data-testid="toggle-stock"
          onClick={() => setAssetType('stock')}
          disabled={isLoading}
          aria-pressed={assetType === 'stock'}
          className={`px-5 py-2 rounded-l-lg text-sm font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
            assetType === 'stock'
              ? 'bg-cyan-500 border-cyan-500 text-black'
              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Stock
        </button>
        <button
          type="button"
          data-testid="toggle-etf"
          onClick={() => setAssetType('etf')}
          disabled={isLoading}
          aria-pressed={assetType === 'etf'}
          className={`px-5 py-2 rounded-r-lg text-sm font-semibold border-t border-b border-r transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
            assetType === 'etf'
              ? 'bg-cyan-500 border-cyan-500 text-black'
              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          ETF / Index Fund
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-4">
        <label htmlFor="ticker-input" className="sr-only">
          {assetType === 'stock' ? 'Stock Ticker' : 'ETF Ticker'}
        </label>
        <div className="relative w-full flex-grow">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a4 4 0 014-4h10a4 4 0 014 4v12a4 4 0 01-4 4H7z"
              />
            </svg>
          </div>
          <input
            id="ticker-input"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="w-full bg-[#0d1117] border border-[var(--color-border)] text-white placeholder-gray-500 text-lg rounded-lg pl-12 pr-4 py-3 focus:ring-2 focus:ring-[var(--color-border-glow)] focus:outline-none transition duration-200 disabled:opacity-50"
            autoCapitalize="characters"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !ticker.trim()}
          className="w-full sm:w-auto bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-lg py-3 px-8 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-background)] focus:ring-cyan-400"
        >
          {isLoading ? 'Analysing...' : 'Analyse'}
        </button>
      </form>

      <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
        <span className="text-sm text-gray-400">Try an example:</span>
        {examples.map((t) => (
          <button
            key={t}
            onClick={() => handleExampleClick(t)}
            disabled={isLoading}
            className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Analyse ${t}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TickerInput;
