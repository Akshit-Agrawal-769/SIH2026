import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { fetchTimeSeries, TimeSeriesResponse } from '../../api/analyticsClient';

interface TimeSeriesTabProps {
  variable: string;
  lat: number;
  lon: number;
  depth: number;
  units: string;
}

export const TimeSeriesTab: React.FC<TimeSeriesTabProps> = ({
  variable,
  lat,
  lon,
  depth,
  units
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<TimeSeriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchTimeSeries(variable, lat, lon, depth)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[TimeSeriesTab] Fetch failed:', err);
        setError('Failed to fetch timeseries data.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [variable, lat, lon, depth]);

  if (loading) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3 text-ocean-muted">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Extracting multi-day hydrodynamic timeseries_points...</p>
      </div>
    );
  }

  if (error || !data || !data.available || !data.timeseries_points.length) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2 p-6 text-center border border-dashed border-ocean-border rounded-xl">
        <AlertCircle className="w-8 h-8 text-amber-400" />
        <h4 className="text-sm font-semibold text-ocean-text-secondary">No Authentic Time Series Available</h4>
        <p className="text-xs text-ocean-muted max-w-md">
          {data?.reason || error || 'Point is on land or outside the active hydrodynamic model domain.'}
        </p>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 mt-2">
          Strict zero-mock policy: missing time steps are not synthetically filled
        </span>
      </div>
    );
  }

  const isUp = (data.delta ?? 0) > 0.01;
  const isDown = (data.delta ?? 0) < -0.01;

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
          <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">Start Value</div>
          <div className="text-base font-bold text-ocean-text mt-0.5">
            {data.start_value !== undefined ? `${data.start_value} ${units}` : '—'}
          </div>
          <div className="text-[10px] text-ocean-muted">{data.timeseries_points[0]?.date}</div>
        </div>

        <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
          <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">End Value</div>
          <div className="text-base font-bold text-teal-300 mt-0.5">
            {data.end_value !== undefined ? `${data.end_value} ${units}` : '—'}
          </div>
          <div className="text-[10px] text-ocean-muted">{data.timeseries_points[data.timeseries_points.length - 1]?.date}</div>
        </div>

        <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
          <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">5-Day Net Delta</div>
          <div className={`text-base font-bold mt-0.5 flex items-center gap-1 ${
            isUp ? 'text-amber-400' : isDown ? 'text-teal-400' : 'text-ocean-text-secondary'
          }`}>
            {isUp && <TrendingUp className="w-4 h-4" />}
            {isDown && <TrendingDown className="w-4 h-4" />}
            {!isUp && !isDown && <Minus className="w-4 h-4" />}
            <span>
              {data.delta !== undefined ? `${data.delta > 0 ? '+' : ''}${data.delta} ${units}` : '—'}
            </span>
          </div>
          <div className="text-[10px] text-ocean-muted">Total temporal shift</div>
        </div>

        <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
          <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">Trend Rate / Day</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">
            {data.trend_slope_per_day !== undefined
              ? `${data.trend_slope_per_day > 0 ? '+' : ''}${data.trend_slope_per_day} ${units}/d`
              : '—'}
          </div>
          <div className="text-[10px] text-ocean-muted">Linear rate of change</div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full bg-ocean-bg/70 border border-ocean-border rounded-xl p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.timeseries_points} margin={{ top: 10, right: 20, left: 0, bottom: 15 }}>
            <defs>
              <linearGradient id="timeSeriesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'Operational Forecast Date', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              domain={['auto', 'auto']}
              label={{ value: `${units}`, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '0.75rem',
                fontSize: '12px'
              }}
              formatter={(val: any) => [`${val} ${units}`, `${variable.toUpperCase()}`]}
              labelFormatter={(lbl) => `Date: ${lbl}`}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#14b8a6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#timeSeriesGradient)"
              dot={{ r: 3, fill: '#14b8a6' }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary Statistics Line */}
      <div className="flex flex-wrap items-center justify-between text-xs text-ocean-muted px-1">
        <div>
          Baseline Range: <span className="text-ocean-text-secondary font-mono">{data.min} {units}</span> to{' '}
          <span className="text-ocean-text-secondary font-mono">{data.max} {units}</span>
        </div>
        <div>
          Temporal Mean: <span className="text-teal-300 font-mono">{data.mean} {units}</span> (σ ={' '}
          <span className="text-ocean-text-secondary font-mono">{data.std} {units}</span>)
        </div>
        <div className="font-mono text-[11px] text-neutral-500">
          Depth slice: {depth}m • Collocated Bio-ROMS
        </div>
      </div>
    </div>
  );
};

