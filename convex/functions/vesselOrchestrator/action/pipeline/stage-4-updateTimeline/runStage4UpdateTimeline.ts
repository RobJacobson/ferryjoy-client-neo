/**
 * Stage #4: project timeline writes from trip + ML inputs.
 */

import type { MlTimelineOverlay } from "domain/vesselOrchestration/shared";
import { updateTimeline } from "domain/vesselOrchestration/updateTimeline";
import type { UpdatedTrips } from "../stage-2-updateVesselTrip/tripWrites";
import { toTimelineHandoffFromUpdatedTrips } from "./toTimelineHandoffFromTripWrites";

type RunStage4UpdateTimelineArgs = {
  pingStartedAt: number;
  updatedTrips: UpdatedTrips;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

/**
 * Runs stage #4 for one vessel branch.
 *
 * @param args - Timeline projection inputs from prior stages
 * @returns Timeline rows to persist for this branch
 */
export const runStage4UpdateTimeline = ({
  pingStartedAt,
  updatedTrips,
  mlTimelineOverlays,
}: RunStage4UpdateTimelineArgs) =>
  updateTimeline({
    pingStartedAt,
    tripHandoffForTimeline: toTimelineHandoffFromUpdatedTrips(updatedTrips),
    mlTimelineOverlays,
  });
