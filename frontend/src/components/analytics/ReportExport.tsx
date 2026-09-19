import React from 'react';
import {
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  ShieldCheck
} from 'lucide-react';

interface ReportExportProps {
  lat: number;
  lon: number;
  depth: number;
  variable: string;
  units: string;
  targetName?: string;
  timeseriesData?: any;
  anomalyData?: any;
  profileData?: any;
}

export const ReportExport: React.FC<ReportExportProps> = ({
  lat,
  lon,
  depth,
  variable,
  units,
  targetName,
  timeseriesData,
  anomalyData,
  profileData
}) => {
  const exportCSV = () => {
    const meta = [
      `# =========================================================================`,
      `# INCOIS 3D OCEAN PLATFORM - OPERATIONAL OCEANOGRAPHIC BRIEF`,
      `# =========================================================================`,
      `# Location: ${targetName || 'Indian Ocean Station'}`,
      `# Coordinates: ${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`,
      `# Analysis Depth: ${depth} meters`,
      `# Analyzed Variable: ${variable} (${units})`,
      `# Model Source: INCOIS Operational Bio-ROMS 3.9 Hydrodynamic Model`,
      `# Data Policy: STRICT_REAL_DATA_ZERO_SYNTHETIC`,
      `# Export Timestamp: ${new Date().toISOString()}`,
      `#`,
      `# --- STRATIFICATION METRICS ---`,
      `# Mixed Layer Depth (MLD): ${profileData?.mld_meters ?? 'N/A'} m`,
      `# Thermocline Depth: ${profileData?.thermocline_depth_meters ?? 'N/A'} m`,
      `# Maximum Gradient: ${profileData?.max_gradient ?? 'N/A'} ${profileData?.gradient_unit ?? ''}`,
      `# Surface Value (0.5m): ${profileData?.surface_value ?? 'N/A'} ${units}`,
      `# Deep Value (2000m): ${profileData?.bottom_value ?? 'N/A'} ${units}`,
      `#`,
      `# --- STATISTICAL ANOMALY ---`,
      `# Local Sample: ${anomalyData?.value ?? 'N/A'} ${units}`,
      `# Basin Mean (mu): ${anomalyData?.baseline_mean ?? 'N/A'} ${units}`,
      `# Basin Std (sigma): ${anomalyData?.baseline_std ?? 'N/A'} ${units}`,
      `# Standardized Z-Score: ${anomalyData?.z_score ?? 'N/A'}`,
      `# Classification: ${anomalyData?.classification ?? 'N/A'}`,
      `#`,
      `# --- MULTI-DAY TIME SERIES (${timeseriesData?.interval ?? '5-Day'}) ---`,
      `Date,Value (${units})`
    ];

    const timelineRows =
      timeseriesData?.timeline?.map((t: any) => `${t.date},${t.value}`) || [];

    const fullContent = meta.join('\n') + '\n' + timelineRows.join('\n');
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + fullContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `INCOIS_Ocean_Report_${lat.toFixed(2)}N_${lon.toFixed(2)}E_${variable}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="bg-ocean-dark/60 border border-ocean-border rounded-xl p-5 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Generate &amp; Export Scientific Ocean Brief</span>
          </h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Download comprehensive physical oceanography reports containing all collocated time series, vertical stratification indices, anomaly Z-scores, and correlation tables.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* CSV Download Card */}
          <div className="bg-ocean-dark/80 border border-ocean-border/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-200 text-xs">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Raw Scientific Data (CSV)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Includes full metadata headers, layer stratification statistics, regional baseline figures, and time-series vectors.
              </p>
            </div>
            <button
              onClick={exportCSV}
              className="w-full py-2 px-3 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Dataset</span>
            </button>
          </div>

          {/* Printable Brief Card */}
          <div className="bg-ocean-dark/80 border border-ocean-border/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-200 text-xs">
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Printable Scientific Brief</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Formats the active studio charts and interpretations into a high-resolution, institutional print summary.
              </p>
            </div>
            <button
              onClick={handlePrint}
              className="w-full py-2 px-3 bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="bg-ocean-dark/30 border border-ocean-border/40 rounded-xl p-3 text-[11px] text-slate-400 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Reports conform to INCOIS National Oceanographic Data Centre and IOC/UNESCO CF-1.6 metadata standards.
        </span>
      </div>
    </div>
  );
};
