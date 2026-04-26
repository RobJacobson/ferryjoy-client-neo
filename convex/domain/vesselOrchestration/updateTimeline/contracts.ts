/**
 * Canonical Stage A public contracts for the timeline concern.
 */

import type { ConvexActualDockEvent } from "domain/events/actual";
import type { ConvexPredictedDockWriteBatch } from "domain/events/predicted";
import type {
  MlTimelineOverlay,
  PersistedTripTimelineHandoff,
} from "domain/vesselOrchestration/shared";

/**
 * Direct same-ping timeline handoff from persisted trip facts plus ML overlay.
 */
export type RunUpdateVesselTimelineFromAssemblyInput = {
  pingStartedAt: number;
  tripHandoffForTimeline: PersistedTripTimelineHandoff;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

export type RunUpdateVesselTimelineOutput = {
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockWriteBatch[];
};
