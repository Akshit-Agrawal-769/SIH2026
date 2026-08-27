import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL SCIENTIFIC WORKSTATION RENDER ERROR:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: '#040711',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '700px',
            backgroundColor: '#0b1324',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            borderRadius: '4px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e', fontWeight: 'bold', fontSize: '14px', marginBottom: '12px' }}>
              <span>⚠</span>
              <span>SCIENTIFIC WORKSTATION INITIALIZATION EXCEPTION</span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.5' }}>
              The application encountered a critical runtime exception while initializing the scientific visualization pipeline:
            </p>
            <pre style={{
              backgroundColor: '#040711',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '12px',
              borderRadius: '2px',
              fontSize: '11px',
              color: '#fca5a5',
              overflowX: 'auto',
              marginBottom: '16px'
            }}>
              {this.state.error?.toString() || 'Unknown Error'}
              {this.state.errorInfo?.componentStack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#38bdf8',
                color: '#040711',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '2px',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'monospace'
              }}
            >
              RELOAD WORKSTATION
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
