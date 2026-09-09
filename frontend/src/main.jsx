import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useOceanStore } from './store/oceanStore';

if (typeof window !== 'undefined') {
  window.useOceanStore = useOceanStore;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('INCOIS System ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-ocean-925 text-white p-6 font-mono">
          <div className="max-w-lg p-6 rounded-2xl bg-black/60 border border-rose-500/40 shadow-2xl backdrop-blur-md">
            <h1 className="text-base font-bold text-rose-400 mb-2">INCOIS 3D System Diagnostic Fault</h1>
            <p className="text-xs text-slate-300 mb-4 font-sans">
              An unexpected render exception occurred. The error details have been logged.
            </p>
            <pre className="p-3 bg-black/80 rounded-lg text-[11px] text-rose-300 overflow-x-auto mb-4 border border-white/10">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
