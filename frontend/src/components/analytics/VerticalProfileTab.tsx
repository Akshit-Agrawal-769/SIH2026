import React, { useState, useEffect } from 'react';
import {
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { fetchVerticalProfileAnalysis, VerticalProfileResponse } from '../../api/analyticsClient';

interface VerticalProfileTabProps {
  variable: string;
  lat: number;
  lon: number;
  units: string;
  date?: string;
}

export const VerticalProfileTab: React.FC<VerticalProfileTabProps> = ({
  variable,
  lat,
  lon,
  units,
  date
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<VerticalProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchVerticalProfileAnalysis(lat, lon, variable, date)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Failed to fetch vertical profile analysis.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lat, lon, variable, date]);

  if (loading) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3 text-ocean-muted">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Reading model levels at this point…</p>
      </div>
    );
  }

  if (error || !data || !data.available || !data.levels.length) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2 p-6 text-center border border-dashed border-ocean-border rounded-xl">
        <AlertCircle className="w-8 h-8 text-amber-400" />
        <h4 className="text-sm font-semibold text-ocean-text-secondary">No model vertical profile</h4>
        <p className="text-xs text-ocean-muted max-w-md">
          {data?.reason || error || 'Point is outside the model domain or on land.'}
        </p>
        {data?.model_mld_meters !== undefined && data?.model_mld_meters !== null && (
          <p className="text-xs text-ocean-text-secondary">
            Model-diagnosed mixed layer depth at {data.date}: <span className="font-mono text-teal-300">{data.model_mld_meters} m</span>
            <span className="block text-[10px] text-ocean-muted">{data.model_mld_source}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stratification & Layering Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
          <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
            Mixed Layer Depth (MLD)
          </div>
          <div className="text-base font-bold text-teal-300 mt-0.5">
            {data.mld_meters !== null && data.mld_meters !== undefined
              ? `${data.mld_meters} m`
              : 'Unstratified'}
          </div>
          <div className="text-[10px] text-ocean-muted">ΔT = 0.2°C from 10m</div>
        </div>

        <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
          <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
            Thermocline Core Depth
          </div>
          <div className="text-base font-bold text-amber-400 mt-0.5">
            {data.thermocline_depth_meters !== undefined
              ? `${data.thermocline_depth_meters} m`
              : '—'}
          </div>
          <div className="text-[10px] text-ocean-muted">Peak gradient layer</div>
        </div>

        <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
          <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
            Max Vertical Gradient
          </div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">
            {data.max_gradient !== undefined ? `${data.max_gradient} ${data.gradient_unit}` : '—'}
          </div>
          <div className="text-[10px] text-ocean-muted">Density barrier strength</div>
        </div>

        <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
          <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
            Shallowest − deepest level
          </div>
          <div className="text-base font-bold text-teal-300 mt-0.5">
            {data.surface_value !== undefined && data.bottom_value !== undefined
              ? `${(data.surface_value - data.bottom_value).toFixed(2)} ${units}`
              : '—'}
          </div>
          <div className="text-[10px] text-ocean-muted">Total column stratification</div>
        </div>
      </div>

      {/* Vertical Chart Canvas */}
      <div className="h-64 w-full bg-ocean-bg/70 border border-ocean-border rounded-xl p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data.levels}
            margin={{ top: 10, right: 20, left: 10, bottom: 15 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" opacity={0.4} />
            <XAxis
              dataKey="depth"
              type="number"
              domain={[0, 'auto']}
              reversed={true}
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              label={{
                value: 'Depth (meters below surface) [Inverted Axis]',
                position: 'insideBottom',
                offset: -10,
                fill: '#a3a3a3',
                fontSize: 11
              }}
            />
            <YAxis
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              label={{
                value: `${units}`,
                angle: -90,
                position: 'insideLeft',
                fill: '#a3a3a3',
                fontSize: 11
              }}
            />
            {data.mld_meters && (
              <ReferenceLine
                x={data.mld_meters}
                stroke="#14b8a6"
                strokeDasharray="3 3"
                label={{
                  value: `MLD: ${data.mld_meters}m`,
                  fill: '#14b8a6',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />
            )}
            {data.thermocline_depth_meters && (
              <ReferenceLine
                x={data.thermocline_depth_meters}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                label={{
                  value: `Thermocline: ${data.thermocline_depth_meters}m`,
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'insideTopLeft'
                }}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: '#171717',
                borderColor: '#404040',
                borderRadius: '0.75rem',
                fontSize: '12px'
              }}
              formatter={(val: any) => [`${val} ${units}`, `${variable.toUpperCase()}`]}
              labelFormatter={(lbl) => `Depth: ${lbl} m`}
            />
            <Line isAnimationActive={false}
              type="linear"
              dataKey="value"
              stroke="#14b8a6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#14b8a6' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-xs text-ocean-muted px-1">
        <div>
          Shallowest level ({data.levels[0]?.depth} m): <span className="text-teal-300 font-mono">{data.surface_value} {units}</span>
        </div>
        <div>
          Deepest level ({data.levels[data.levels.length - 1]?.depth} m): <span className="text-teal-300 font-mono">{data.bottom_value} {units}</span>
        </div>
        <div className="font-mono text-[11px] text-neutral-500">
          Model levels: {data.model_depths?.join(', ')} m
        </div>
      </div>
    </div>
  );
};
