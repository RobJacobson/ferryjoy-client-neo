/**
 * Canonical Stage A public contracts for the timeline concern.
 */

import type { ConvexActualDockEvent } from "domain/events/actual";
import type { ConvexPredictedDockWriteBatch } from "domain/events/predicted";
import type { MlTimelineOverlay } from "domain/vesselOrchestration/shared";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";

/**
 * Direct same-ping timeline projection from upstream trip rows plus ML overlay.
 *
 * The handoff used by the projection step is derived inside `updateTimeline`
 * from `tripUpdate`; callers do not need to construct it manually.
 */
export type RunUpdateVesselTimelineFromAssemblyInput = {
  pingStartedAt: number;
  tripUpdate: VesselTripUpdate;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

export type RunUpdateVesselTimelineOutput = {
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockWriteBatch[];
};
