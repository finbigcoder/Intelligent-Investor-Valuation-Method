import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{
      color: '#f87171', background: '#1a1a1a', padding: '2rem',
      fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap',
      position: 'fixed', inset: 0, overflow: 'auto', zIndex: 9999,
    }}>
      <strong style={{ fontSize: '18px' }}>React Error — please copy and share this:</strong>
      {'\n\n'}{error.message}{'\n\n'}{error.stack}
    </div>
  );
}

interface EBState { error: Error | null }
class ErrorBoundary extends React.Component<React.PropsWithChildren, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(e: Error): EBState { return { error: e }; }
  render() {
    return this.state.error
      ? React.createElement(ErrorFallback, { error: this.state.error })
      : (this as unknown as React.Component<React.PropsWithChildren>).props.children;
  }
}

const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(
  React.createElement(ErrorBoundary, null, React.createElement(App))
);
