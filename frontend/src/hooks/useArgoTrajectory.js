import { useMemo, useState, useCallback } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { normalizeTrajectory, findCycleInTrajectory, calculateTravelHeadingDeg } from '../utils/argo';

/**
 * Custom React hook for managing Argo float multi-cycle trajectory state,
 * chronological cycle navigation, and profile synchronization.
 */
export function useArgoTrajectory() {
  const {
    selectedFloat,
    selectedCycle,
    setSelectedCycle,
    fetchArgoProfile,
    activeArgoProfile,
    isLoading,
    focusCoordinateInExplorer,
  } = useOceanStore();

  const [showTrajectory, setShowTrajectory] = useState(true);

  // 1. Memoized normalized and chronologically sorted trajectory points
  const trajectory = useMemo(() => {
    if (!selectedFloat) return [];
    return normalizeTrajectory(selectedFloat.trajectory, selectedFloat.cycles);
  }, [selectedFloat]);

  // 2. Active cycle number (falling back to latest cycle or 1)
  const activeCycle = useMemo(() => {
    if (selectedCycle !== null && selectedCycle !== undefined) {
      return selectedCycle;
    }
    if (selectedFloat?.latest_cycle !== undefined && selectedFloat.latest_cycle !== null) {
      return selectedFloat.latest_cycle;
    }
    if (trajectory.length > 0) {
      return trajectory[trajectory.length - 1].cycleNumber;
    }
    return selectedFloat?.cycles?.[0] || 1;
  }, [selectedCycle, selectedFloat, trajectory]);

  // 3. Find active cycle point record in trajectory
  const activePoint = useMemo(() => {
    return findCycleInTrajectory(trajectory, activeCycle);
  }, [trajectory, activeCycle]);

  // 4. Current 0-based index in trajectory array
  const currentIndex = useMemo(() => {
    if (trajectory.length === 0) return 0;
    const idx = trajectory.findIndex((pt) => pt.cycleNumber === activeCycle);
    return idx >= 0 ? idx : trajectory.length - 1;
  }, [trajectory, activeCycle]);

  // 5. Travel direction heading angle (degrees)
  const headingDeg = useMemo(() => {
    if (currentIndex > 0 && trajectory.length >= 2) {
      const prev = trajectory[currentIndex - 1];
      const curr = trajectory[currentIndex];
      return calculateTravelHeadingDeg(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }
    return null;
  }, [trajectory, currentIndex]);

  // 6. Action: select specific cycle number
  const selectCycleNumber = useCallback(
    (cycleNum, panCamera = false) => {
      if (!selectedFloat) return;
      const targetPt = findCycleInTrajectory(trajectory, cycleNum);
      setSelectedCycle(cycleNum);
      fetchArgoProfile(selectedFloat.platform_number, cycleNum);

      if (panCamera && targetPt) {
        focusCoordinateInExplorer(
          targetPt.latitude,
          targetPt.longitude,
          `Argo WMO ${selectedFloat.platform_number} (Cycle #${cycleNum})`
        );
      }
    },
    [selectedFloat, trajectory, setSelectedCycle, fetchArgoProfile, focusCoordinateInExplorer]
  );

  // 7. Action: step cycle previous / next
  const stepCycle = useCallback(
    (delta) => {
      if (trajectory.length === 0) return;
      let nextIdx = currentIndex + delta;
      if (nextIdx < 0) nextIdx = 0;
      if (nextIdx >= trajectory.length) nextIdx = trajectory.length - 1;

      const nextPt = trajectory[nextIdx];
      if (nextPt && nextPt.cycleNumber !== activeCycle) {
        selectCycleNumber(nextPt.cycleNumber, false);
      }
    },
    [trajectory, currentIndex, activeCycle, selectCycleNumber]
  );

  return {
    selectedFloat,
    trajectory,
    activePoint,
    activeCycle,
    currentIndex,
    totalCycles: trajectory.length || selectedFloat?.cycles?.length || 1,
    headingDeg,
    showTrajectory,
    setShowTrajectory,
    toggleTrajectory: () => setShowTrajectory((prev) => !prev),
    selectCycleNumber,
    stepCycle,
    activeArgoProfile,
    isLoading,
  };
}
