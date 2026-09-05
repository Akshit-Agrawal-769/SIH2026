import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useOceanStore } from './store/oceanStore';

if (typeof window !== 'undefined') {
  window.useOceanStore = useOceanStore;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
