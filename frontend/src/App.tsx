import React, { useEffect, useState } from 'react';
import { DatasetHealth } from './types/ocean';

export default function App() {
  const [health, setHealth] = useState<DatasetHealth | null>(null);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error("Error fetching dataset health:", err));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid #334155', pb: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ color: '#38bdf8' }}>INCOIS 3D Ocean Data Visualization System</h1>
        <p style={{ color: '#94a3b8' }}>
          Integrated 3D Volumetric Ocean Model Rendering & In-Situ Observation Platform
        </p>
      </header>

      <main>
        <section style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <h2>System Data Status & Health Check</h2>
          {health ? (
            <div>
              <p>
                <strong>Status:</strong>{' '}
                <span style={{ color: health.status === 'healthy' ? '#4ade80' : '#f87171' }}>
                  {health.status}
                </span>
              </p>
              <p><strong>Data Policy:</strong> {health.data_policy}</p>
              
              <h3 style={{ marginTop: '1rem', color: '#cbd5e1' }}>Available Real Datasets</h3>
              {health.available_datasets.length > 0 ? (
                <ul>
                  {health.available_datasets.map((ds, i) => <li key={i}>{ds}</li>)}
                </ul>
              ) : (
                <p style={{ color: '#f87171' }}>No active NetCDF datasets loaded in datasets/ directory.</p>
              )}

              {health.missing_datasets.length > 0 && (
                <div style={{ background: '#451a03', border: '1px solid #b45309', padding: '1rem', borderRadius: '6px', marginTop: '1rem' }}>
                  <h4 style={{ color: '#f97316', margin: 0 }}>REAL DATASET REQUIRED</h4>
                  <p style={{ margin: '0.5rem 0 0 0' }}>Place real INCOIS ROMS model files in <code>datasets/model/</code> and Argo files in <code>datasets/argo/</code>.</p>
                  <ul>
                    {health.missing_datasets.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p>Checking server dataset health...</p>
          )}
        </section>
      </main>
    </div>
  );
}
