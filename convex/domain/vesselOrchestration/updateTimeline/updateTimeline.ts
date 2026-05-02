/**
 * Canonical timeline assembly entry: **`VesselTripUpdate`** + prediction handoffs
 * → actual/predicted timeline event writes.
 */

import type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";
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
    input.predictedTripTimelineHandoffs,
    input.pingStartedAt
  );
