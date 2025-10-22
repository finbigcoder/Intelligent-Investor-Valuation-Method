
import React from 'react';
import type { HistoryEntry, Recommendation } from '../types';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelect: (ticker: string) => void;
  onClear: () => void;
}

const recommendationStyles: Record<Recommendation, string> = {
    'Strong Buy': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    'Buy': 'bg-green-500/10 text-green-300 border-green-500/30',
    'Hold': 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    'Sell': 'bg-red-500/10 text-red-300 border-red-500/30',
    'Speculative': 'bg-purple-500/10 text-purple-300 border-purple-500/30',
};

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose, history, onSelect, onClear }) => {
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-[var(--color-background)] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-[var(--color-border)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-panel-title"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-[var(--color-border)]">
            <h2 id="history-panel-title" className="text-xl font-bold text-white">Valuation History</h2>
            <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors" aria-label="Close history panel">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-grow overflow-y-auto p-4">
            {history.length > 0 ? (
              <ul className="space-y-3">
                {history.map((entry, index) => (
                  <li key={`${entry.ticker}-${entry.valuationDate}-${index}`}>
                    <button 
                      onClick={() => onSelect(entry.ticker)}
                      className="w-full text-left p-4 bg-white/5 rounded-lg hover:bg-white/10 border border-transparent hover:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all duration-200"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-bold text-lg text-white">{entry.ticker} - <span className="font-normal text-gray-300">{entry.companyName}</span></p>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${recommendationStyles[entry.recommendation]}`}>
                          {entry.recommendation}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{formatDate(entry.valuationDate)}</p>
                      <p className="text-sm text-gray-500 mt-1">Intrinsic Value: ${entry.intrinsicValue > 0 ? entry.intrinsicValue.toFixed(2) : 'N/A'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg">No history yet.</p>
                <p>Perform a valuation to see it here.</p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          {history.length > 0 && (
            <div className="p-4 border-t border-[var(--color-border)]">
              <button 
                onClick={onClear} 
                className="w-full bg-red-800/50 hover:bg-red-700/50 border border-red-700/50 text-red-200 font-bold py-2 px-4 rounded-md transition-colors"
              >
                Clear History
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default HistoryPanel;