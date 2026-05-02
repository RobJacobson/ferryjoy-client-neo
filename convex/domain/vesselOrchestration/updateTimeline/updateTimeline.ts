/**
 * Canonical timeline assembly entry: **`VesselTripUpdate`** + prediction handoffs
 * → actual/predicted timeline event writes.
 */

import { buildCompletedHandoffKey } from "./completedHandoffKey";
import type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";
import type { PredictedTripTimelineHandoff } from "./handoffTypes";
import { projectTimelineFromHandoff } from "./projectTimelineFromHandoff";
import { timelineHandoffFromTripUpdate } from "./timelineHandoffFromTripUpdate";

/**
 * @param input - Ping start time, upstream trip update, and same-update
 *   prediction handoffs for timeline merge
 */
export const updateTimeline = (
  input: RunUpdateVesselTimelineFromAssemblyInput
): RunUpdateVesselTimelineOutput =>
  projectTimelineFromHandoff(
    timelineHandoffFromTripUpdate(input.tripUpdate),
    predictedTripTimelineHandoffsFromInput(input),
    input.pingStartedAt
  );

const predictedTripTimelineHandoffsFromInput = (
  input: RunUpdateVesselTimelineFromAssemblyInput
): ReadonlyArray<PredictedTripTimelineHandoff> => {
  const current = {
    vesselAbbrev: input.enrichedActiveVesselTrip.VesselAbbrev,
    branch: "current",
    finalPredictedTrip: input.enrichedActiveVesselTrip,
  } as const;

  if (
    input.tripUpdate.existingVesselTrip === undefined ||
    input.tripUpdate.completedVesselTrip === undefined
  ) {
    return [current];
  }

  return [
    {
      vesselAbbrev: input.tripUpdate.completedVesselTrip.VesselAbbrev,
      branch: "completed",
      completedHandoffKey: buildCompletedHandoffKey(
        input.tripUpdate.completedVesselTrip.VesselAbbrev,
        input.tripUpdate.completedVesselTrip,
        input.tripUpdate.activeVesselTrip
      ),
      finalPredictedTrip: input.enrichedActiveVesselTrip,
    },
    current,
  ];
};
