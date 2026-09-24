import React, { useState, useEffect } from 'react';
import * as Cesium from 'cesium';
import { SCIENCE_TOURS, ScienceTour, TourStep } from '../outreach/toursData';
import { useOceanStore } from '../store/useOceanStore';
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  X,
  BookOpen,
  Clock,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';

interface OutreachTourOverlayProps {
  viewer: Cesium.Viewer | null;
}

export const OutreachTourOverlay: React.FC<OutreachTourOverlayProps> = ({ viewer }) => {
  const {
    setMode,
    setSelectedVariable,
    setDepthLevel,
    setLayers,
    setCurrentTime,
    setIsPlaying,
    setSelectedInstrumentId
  } = useOceanStore();

  const [activeTour, setActiveTour] = useState<ScienceTour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  // Execute camera movement and state synchronization when a tour step changes
  const applyTourStep = (step: TourStep) => {
    if (!viewer || viewer.isDestroyed()) return;

    // 1. Smooth cinematic camera flight
    const dest = Cesium.Cartesian3.fromDegrees(
      step.camera.lon,
      step.camera.lat,
      step.camera.height
    );

    viewer.camera.flyTo({
      destination: dest,
      orientation: {
        heading: Cesium.Math.toRadians(step.camera.heading ?? 0),
        pitch: Cesium.Math.toRadians(step.camera.pitch ?? -70),
        roll: 0.0
      },
      duration: step.camera.duration ?? 2.5
    });

    // 2. Co-ordinate physical ocean variables and layers
    setSelectedVariable(step.variable);
    setDepthLevel(step.depth);
    setLayers(step.activeLayers);

    if (step.time) {
      setCurrentTime(step.time);
    }
    if (step.isPlaying !== undefined) {
      setIsPlaying(step.isPlaying);
    }
    if (step.selectedInstrumentId !== undefined) {
      setSelectedInstrumentId(step.selectedInstrumentId);
    }
  };

  const handleStartTour = (tour: ScienceTour) => {
    setActiveTour(tour);
    setCurrentStepIndex(0);
    applyTourStep(tour.steps[0]);
  };

  const handleNextStep = () => {
    if (!activeTour) return;
    if (currentStepIndex < activeTour.steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      applyTourStep(activeTour.steps[nextIdx]);
    } else {
      // Completed tour
      setActiveTour(null);
      setIsAutoAdvancing(false);
    }
  };

  const handlePrevStep = () => {
    if (!activeTour || currentStepIndex <= 0) return;
    const prevIdx = currentStepIndex - 1;
    setCurrentStepIndex(prevIdx);
    applyTourStep(activeTour.steps[prevIdx]);
  };

  const handleExitTour = () => {
    setActiveTour(null);
    setIsAutoAdvancing(false);
    setIsPlaying(false);
    setSelectedInstrumentId(null);
  };

  // Auto-advance timer (e.g. 12s per step when active)
  useEffect(() => {
    if (!isAutoAdvancing || !activeTour) return;

    const timer = setTimeout(() => {
      handleNextStep();
    }, 12000);

    return () => clearTimeout(timer);
  }, [isAutoAdvancing, activeTour, currentStepIndex]);

  // Case 1: No active tour — Display Tour Catalog Deck
  if (!activeTour) {
    return (
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-6 z-20">
        <div className="pointer-events-auto max-w-5xl mx-auto w-full glass-panel rounded-2xl p-6 shadow-2xl border border-white/15">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white tracking-wide">
                    Indian Ocean Science Tours
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                    Public Outreach Mode
                  </span>
                </div>
                <p className="text-xs text-ocean-text-secondary mt-0.5">
                  Select an interactive guided narrative to explore real oceanographic phenomena with dynamic 3D camera choreography.
                </p>
              </div>
            </div>

            <button
              onClick={() => setMode('operational')}
              className="px-3 py-1.5 rounded-full glass-pill border border-white/10 text-xs text-ocean-text-secondary hover:text-white transition flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Return to Operational</span>
            </button>
          </div>

          {/* Tours Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {SCIENCE_TOURS.map((tour) => (
              <div
                key={tour.id}
                onClick={() => handleStartTour(tour)}
                className="group relative glass-card-subtle hover:bg-white/10 border border-white/10 hover:border-emerald-400/50 rounded-xl p-4 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-emerald-500/10 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 text-ocean-text-secondary border border-white/10">
                      {tour.category}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {tour.duration}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug mb-1">
                    {tour.title}
                  </h3>
                  <p className="text-[11px] text-ocean-muted line-clamp-2 leading-relaxed mb-3">
                    {tour.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Start Story Tour</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Active tour is currently running — Display Cinematic Narrative Card
  const step = activeTour.steps[currentStepIndex];
  const isLastStep = currentStepIndex === activeTour.steps.length - 1;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-6 z-20">
      <div className="pointer-events-auto max-w-2xl mx-auto w-full glass-panel rounded-2xl p-5 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 border border-white/15">
        {/* Tour Header & Progress */}
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              {activeTour.title}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Step Progress Pills */}
            <div className="flex items-center gap-1.5">
              {activeTour.steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentStepIndex(idx);
                    applyTourStep(activeTour.steps[idx]);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-6 bg-emerald-400'
                      : idx < currentStepIndex
                      ? 'w-2.5 bg-emerald-700'
                      : 'w-2 bg-neutral-700'
                  }`}
                  title={`Jump to Step ${idx + 1}`}
                />
              ))}
            </div>

            <span className="text-[11px] font-mono text-ocean-muted">
              {currentStepIndex + 1} / {activeTour.steps.length}
            </span>

            {/* Exit tour */}
            <button
              onClick={handleExitTour}
              title="Close Tour"
              className="p-1 rounded-lg hover:bg-white/10 text-ocean-muted hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Narrative Content */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-base font-black text-white tracking-tight">
              {step.title}
            </h3>
            <span className="text-xs text-ocean-muted font-medium">
              — {step.subtitle}
            </span>
          </div>

          <p className="text-xs text-ocean-text-secondary leading-relaxed font-sans mb-3.5">
            {step.narrative}
          </p>

          {/* Key Insights Chips */}
          <div className="flex flex-wrap gap-1.5">
            {step.keyInsights.map((insight, idx) => (
              <span
                key={idx}
                className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-emerald-300 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                {insight}
              </span>
            ))}
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition ${
                currentStepIndex === 0
                  ? 'opacity-40 cursor-not-allowed border-transparent text-neutral-600'
                  : 'glass-pill border border-white/10 hover:border-emerald-400 text-ocean-text-secondary hover:text-white'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setIsAutoAdvancing(!isAutoAdvancing)}
              title={isAutoAdvancing ? 'Pause Auto-Tour' : 'Enable Auto-Advance (12s)'}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                isAutoAdvancing
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'glass-pill border border-white/10 text-ocean-muted hover:text-white'
              }`}
            >
              {isAutoAdvancing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isAutoAdvancing ? 'Auto-Playing' : 'Auto-Play'}</span>
            </button>
          </div>

          <button
            onClick={handleNextStep}
            className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 active:scale-95"
          >
            <span>{isLastStep ? 'Complete Tour' : 'Next Chapter'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
