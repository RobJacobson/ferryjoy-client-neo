/**
 * Pure derivation for depart-next prediction actualization intents.
 */

import {
  currentTripDockEvents,
  type VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrip";
import { buildBoundaryKey } from "shared/keys";
import { floorToSecond } from "shared/time";

export type DepartNextActualizationIntent = {
  vesselAbbrev: string;
  depBoundaryKey: string;
  actualDepartMs: number;
};

/**
 * Builds a depart-next actualization intent when a vessel just leaves dock.
 *
 * @param tripUpdate - Sparse per-vessel trip update from the orchestrator stage
 * @returns Actualization intent for dep-dock predicted rows, or `null`
 */
export const deriveDepartNextActualizationIntent = (
  tripUpdate: VesselTripUpdate
): DepartNextActualizationIntent | null => {
  const activeTrip = tripUpdate.activeVesselTripUpdate;
  const leftDockActual = activeTrip.LeftDockActual;
  if (leftDockActual === undefined || !activeTrip.ScheduleKey) {
    return null;
  }

  const { didJustLeaveDock } = currentTripDockEvents(
    tripUpdate.existingActiveTrip,
    activeTrip
  );
  if (!didJustLeaveDock) {
    return null;
  }

  return {
    vesselAbbrev: tripUpdate.vesselAbbrev,
    depBoundaryKey: buildBoundaryKey(activeTrip.ScheduleKey, "dep-dock"),
    actualDepartMs: floorToSecond(leftDockActual),
  };
};
