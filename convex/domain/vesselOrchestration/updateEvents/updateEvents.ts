/**
 * Canonical event assembly entry: **`VesselTripUpdate`** + prediction handoffs
 * → actual/predicted dock event writes.
 */

import { buildCompletedHandoffKey } from "./completedHandoffKey";
import type {
  RunUpdateVesselEventsFromAssemblyInput,
  RunUpdateVesselEventsOutput,
} from "./contracts";
import { eventHandoffFromTripUpdate } from "./eventHandoffFromTripUpdate";
import type { PredictedTripEventHandoff } from "./handoffTypes";
import { projectEventsFromHandoff } from "./projectEventsFromHandoff";

/**
 * @param input - Ping start time, upstream trip update, and same-update
 *   prediction handoffs for event merge
 */
export const updateEvents = (
  input: RunUpdateVesselEventsFromAssemblyInput
): RunUpdateVesselEventsOutput =>
  projectEventsFromHandoff(
    eventHandoffFromTripUpdate(input.tripUpdate),
    predictedTripEventHandoffsFromInput(input),
    input.pingStartedAt
  );

const predictedTripEventHandoffsFromInput = (
  input: RunUpdateVesselEventsFromAssemblyInput
): ReadonlyArray<PredictedTripEventHandoff> => {
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
