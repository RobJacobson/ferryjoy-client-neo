/**
 * Derive a {@link PersistedTripTimelineHandoff} from a sparse trip update.
 *
 * Pure helper colocated with `updateTimeline` so the timeline domain owns its
 * own input derivation from upstream trip rows.
 */

import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import {
  buildCompletionTripEvents,
  currentTripEvents,
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
  const existingActiveTrip = tripUpdate.existingActiveTrip;
  const activeTrip = tripUpdate.activeVesselTripUpdate;
  const completedTrip = tripUpdate.completedVesselTripUpdate;
  const completedTripFacts =
    existingActiveTrip === undefined || completedTrip === undefined
      ? []
      : [
          {
            existingTrip: existingActiveTrip,
            tripToComplete: completedTrip,
            events: buildCompletionTripEvents(
              existingActiveTrip,
              completedTrip
            ),
            scheduleTrip: activeTrip,
          },
        ];
  const events = currentTripEvents(existingActiveTrip, activeTrip);
  const pendingActualWrite =
    !events.didJustLeaveDock && !events.didJustArriveAtDock
      ? undefined
      : {
          events,
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
