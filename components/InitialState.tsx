import React from 'react';

const InitialState: React.FC = () => (
  <div className="glass-card glowing-border rounded-xl shadow-xl p-8 text-center animate-fade-in-up fintech-bg overflow-hidden">
    <div className="max-w-lg mx-auto relative z-10">
      <svg className="mx-auto h-20 w-20 text-[var(--color-primary)] mb-4" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 60L35 45L45 55L65 35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"/>
        <circle cx="20" cy="60" r="4" fill="var(--color-background)" stroke="currentColor" strokeWidth="3"/>
        <circle cx="35" cy="45" r="4" fill="var(--color-background)" stroke="currentColor" strokeWidth="3"/>
        <circle cx="45" cy="55" r="4" fill="var(--color-background)" stroke="currentColor" strokeWidth="3"/>
        <circle cx="65" cy="35" r="4" fill="var(--color-background)" stroke="currentColor" strokeWidth="3"/>
        <rect x="10" y="10" width="60" height="60" rx="5" stroke="currentColor" strokeWidth="3" strokeDasharray="5 5" className="opacity-40"/>
      </svg>
      <h2 className="text-2xl font-bold text-white mb-2">Unlock Value Investing Insights</h2>
      <p className="text-[var(--color-text-secondary)]">
        Enter a stock ticker from NYSE or NASDAQ to receive an automated valuation based on the principles of Benjamin Graham's "The Intelligent Investor".
      </p>
    </div>
  </div>
);

export default InitialState;