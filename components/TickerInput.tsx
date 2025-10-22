import React, { useState } from 'react';

interface TickerInputProps {
  onValuate: (ticker: string) => void;
  isLoading: boolean;
}

const TickerInput: React.FC<TickerInputProps> = ({ onValuate, isLoading }) => {
  const [ticker, setTicker] = useState('');
  const exampleTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      onValuate(ticker.trim().toUpperCase());
      setTicker('');
    }
  };

  const handleExampleClick = (exampleTicker: string) => {
    onValuate(exampleTicker);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-4">
        <label htmlFor="ticker-input" className="sr-only">
          Stock Ticker
        </label>
        <div className="relative w-full flex-grow">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a4 4 0 014-4h10a4 4 0 014 4v12a4 4 0 01-4 4H7z" />
            </svg>
          </div>
          <input
            id="ticker-input"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Enter Stock Ticker (e.g., GOOGL)"
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
          {isLoading ? 'Valuating...' : 'Valuate'}
        </button>
      </form>
       <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
        <span className="text-sm text-gray-400">Try an example:</span>
        {exampleTickers.map(t => (
          <button 
            key={t} 
            onClick={() => handleExampleClick(t)}
            disabled={isLoading}
            className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Valuate ${t}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TickerInput;