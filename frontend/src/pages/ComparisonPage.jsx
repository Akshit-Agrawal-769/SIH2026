import React, { useState, useEffect } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { computeResidualsAndMetrics } from '../utils/comparison';
import { ComparisonHeader } from '../components/ComparisonHeader';
import { ModelProfile } from '../components/ModelProfile';
import { ObservationProfile } from '../components/ObservationProfile';
import { ResidualProfile } from '../components/ResidualProfile';
import { ComparisonMetrics } from '../components/ComparisonMetrics';
import { ComparisonMethodologyModal } from '../components/ComparisonMethodologyModal';
import { Activity, AlertCircle, RefreshCw } from 'lucide-react';

export const ComparisonPage = () => {
  const {
    comparisonData,
    selectedFloat,
    selectedCycle,
    activeDataset,
    variable,
    fetchComparison,
    depthLevelMeters,
    setDepthLevelMeters,
    isLoading,
    errorState,
  } = useOceanStore();

  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const [activeDepth, setActiveDepth] = useState(depthLevelMeters || 0);

  // Sync initial comparison if not already loaded
  useEffect(() => {
    if (!comparisonData && selectedFloat) {
      fetchComparison(
        selectedFloat.platform_number,
        selectedCycle ?? selectedFloat.cycles?.[0] ?? 1,
        variable,
        activeDataset
      );
    }
  }, [comparisonData, selectedFloat, selectedCycle, variable, activeDataset, fetchComparison]);

  const depths = comparisonData?.depths || [];
  const obsValues = comparisonData?.obs_values || [];
  const modelValues = comparisonData?.model_interpolated_values || [];

  // Compute metrics, depth residuals, and data accounting
  const { metrics, validPairs, dataAccounting } = computeResidualsAndMetrics(
    obsValues,
    modelValues,
    depths
  );

  const unit = variable === 'temp' ? '°C' : 'PSU';

  const handleSelectDepth = (depth) => {
    setActiveDepth(depth);
    setDepthLevelMeters(depth);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--surface-base)] text-slate-200 overflow-hidden font-mono select-none">
      {/* Header Bar */}
      <ComparisonHeader onOpenMethodology={() => setIsMethodologyOpen(true)} />

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-28 gap-2 text-slate-400">
            <Activity className="w-6 h-6 animate-pulse text-amber-400" />
            <span className="text-xs">Colocating 4D ROMS Model with In-Situ Observation...</span>
          </div>
        ) : errorState ? (
          <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded-sm flex items-center justify-between text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{errorState}</span>
            </div>
            <button
              onClick={() => {
                if (selectedFloat) {
                  fetchComparison(selectedFloat.platform_number, selectedCycle, variable, activeDataset);
                }
              }}
              className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 border border-rose-400 text-rose-100 rounded-[2px] text-[11px] transition-colors"
            >
              RETRY COLOCATION
            </button>
          </div>
        ) : (
          <>
            {/* Top Row: Split Model vs Observation Profiles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <ModelProfile
                depths={depths}
                modelValues={modelValues}
                activeDepth={activeDepth}
                onSelectDepth={handleSelectDepth}
                variable={variable}
                unit={unit}
              />

              <ObservationProfile
                depths={depths}
                obsValues={obsValues}
                activeDepth={activeDepth}
                onSelectDepth={handleSelectDepth}
                variable={variable}
                unit={unit}
              />
            </div>

            {/* Middle Row: Central Residual Profile (Model - Obs) */}
            <ResidualProfile
              validPairs={validPairs}
              activeDepth={activeDepth}
              onSelectDepth={handleSelectDepth}
              variable={variable}
              unit={unit}
            />

            {/* Bottom Row: Scorecard & Verification Metrics */}
            <ComparisonMetrics
              metrics={metrics}
              dataAccounting={dataAccounting}
              unit={unit}
              onOpenMethodology={() => setIsMethodologyOpen(true)}
            />
          </>
        )}
      </div>

      {/* Methodology & Formulas Modal */}
      <ComparisonMethodologyModal
        isOpen={isMethodologyOpen}
        onClose={() => setIsMethodologyOpen(false)}
      />
    </div>
  );
};