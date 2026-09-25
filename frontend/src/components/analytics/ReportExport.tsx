import React from 'react';
import { Download, Printer, FileSpreadsheet, FileText, Info } from 'lucide-react';
import type { AnomalyResponse, TimeSeriesResponse, VerticalProfileResponse } from '../../api/analyticsClient';

interface ReportExportProps {
  lat: number;
  lon: number;
  depth: number;
  variable: string;
  units: string;
  targetName?: string;
  date?: string;
  sourceTitle?: string;
  timeseriesData?: TimeSeriesResponse | null;
  anomalyData?: AnomalyResponse | null;
  profileData?: VerticalProfileResponse | null;
}

const na = (v: unknown) => (v === null || v === undefined || v === '' ? 'n/a' : String(v));

export const ReportExport: React.FC<ReportExportProps> = ({
  lat, lon, depth, variable, units, targetName, date, sourceTitle, timeseriesData, anomalyData, profileData
}) => {
  const exportCSV = () => {
    const meta = [
      '# INCOIS 3D Ocean Platform - point analysis export',
      `# Location: ${targetName || 'selected point'} (${lat.toFixed(4)} N, ${lon.toFixed(4)} E)`,
      `# Variable: ${variable} (${units}), depth ${depth} m, analysed timestep ${na(date)}`,
      `# Source: ${na(sourceTitle)}`,
      `# Exported: ${new Date().toISOString()}`,
      '#',
      `# Model MLD (source diagnostic): ${na(profileData?.model_mld_meters)} m`,
      `# Vertical profile: ${profileData?.available ? 'available' : `unavailable - ${na(profileData?.reason)}`}`,
      '#',
      `# Spatial z-score: ${na(anomalyData?.z_score)} (value ${na(anomalyData?.value)} ${units}; domain mean ${na(anomalyData?.baseline_mean)}, ` +
        `std ${na(anomalyData?.baseline_std)}, n=${na(anomalyData?.baseline_samples)}; same-day spatial baseline, not a climatology)`,
      '#',
      `# Time series: ${na(timeseriesData?.interval)}; OLS slope ${na(timeseriesData?.trend_slope_per_30_days)} ${units}/30 days ` +
        `(${na(timeseriesData?.trend_method)})`,
      `# Missing timesteps at this point: ${(timeseriesData?.missing_dates ?? []).join(' ') || 'none'}`,
      `date,${variable}_${units.replace(/[^A-Za-z0-9]/g, '')}`
    ];
    const rows = timeseriesData?.timeseries_points?.map((t) => `${t.date},${t.value}`) ?? [];
    const blob = new Blob([[...meta, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `INCOIS_point_${lat.toFixed(2)}N_${lon.toFixed(2)}E_${variable}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-5 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-400" />
            <span>Export</span>
          </h4>
          <p className="text-xs text-ocean-muted mt-1 leading-relaxed">
            The CSV contains the monthly series at this point plus the computed statistics and their definitions.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="bg-ocean-bg/80 border border-ocean-border/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center gap-2 font-semibold text-ocean-text-secondary text-xs">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>CSV</span>
            </div>
            <button
              onClick={exportCSV}
              disabled={!timeseriesData?.timeseries_points?.length}
              className="w-full py-2 px-3 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV</span>
            </button>
          </div>
          <div className="bg-ocean-bg/80 border border-ocean-border/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center gap-2 font-semibold text-ocean-text-secondary text-xs">
              <Printer className="w-4 h-4 text-teal-400" />
              <span>Print the current view</span>
            </div>
            <button
              onClick={() => window.print()}
              className="w-full py-2 px-3 bg-teal-600/30 hover:bg-teal-600/40 text-teal-200 border border-teal-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-teal-300"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      </div>
      <div className="bg-ocean-bg/30 border border-ocean-border/40 rounded-xl p-3 text-[11px] text-ocean-muted flex items-center gap-2">
        <Info className="w-4 h-4 text-ocean-muted shrink-0" />
        <span>Values are copied from the API responses shown in the other tabs; nothing is recomputed or filled in the browser.</span>
      </div>
    </div>
  );
};
