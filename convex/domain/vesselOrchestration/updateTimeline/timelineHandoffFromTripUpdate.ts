/**
 * Derive a {@link PersistedTripTimelineHandoff} from a sparse trip update.
 *
 * Pure helper colocated with `updateTimeline` so the timeline domain owns its
 * own input derivation from upstream trip rows.
 */

import {
  currentTripDockEvents,
  type VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrip";
import type { PersistedTripTimelineHandoff } from "./handoffTypes";

/**
 * Builds the timeline handoff input from existing and updated trip rows.
 *
 * @param tripUpdate - Sparse trip update rows for the current vessel branch
 * @returns Timeline handoff used by the timeline projection stage
 */
export const timelineHandoffFromTripUpdate = (
  tripUpdate: VesselTripUpdate
): PersistedTripTimelineHandoff => {
  const existingActiveTrip = tripUpdate.existingVesselTrip;
  const activeTrip = tripUpdate.activeVesselTrip;
  const completedTrip = tripUpdate.completedVesselTrip;
  const completedTripFacts =
    existingActiveTrip !== undefined && completedTrip !== undefined
      ? [
          {
            existingVesselTrip: existingActiveTrip,
            completedVesselTrip: completedTrip,
            activeVesselTrip: activeTrip,
          },
        ]
      : [];
  const dockEvents = currentTripDockEvents(existingActiveTrip, activeTrip);
  const pendingActualWrite =
    !dockEvents.didJustLeaveDock && !dockEvents.didJustArriveAtDock
      ? undefined
      : {
          ...dockEvents,
          scheduleTrip: activeTrip,
          vesselAbbrev: activeTrip.VesselAbbrev,
        };
  const pendingPredictedWrite = {
    existingTrip: existingActiveTrip,
    scheduleTrip: activeTrip,
    vesselAbbrev: activeTrip.VesselAbbrev,
  };
  return {
    completedTripFacts,
    currentBranch: {
      successfulVesselAbbrev: activeTrip.VesselAbbrev,
      pendingActualWrite,
      pendingPredictedWrite,
    },
  };
};
