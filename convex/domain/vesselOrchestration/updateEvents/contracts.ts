/**
 * Canonical Stage A public contracts for the event concern.
 */

import type { ConvexActualDockEvent } from "domain/events/actual";
import type { ConvexPredictedDockWriteBatch } from "domain/events/predicted";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";

/**
 * Direct same-ping event projection from upstream trip rows plus ML overlay.
 *
 * The handoff used by the projection step is derived inside `updateEvents`
 * from `tripUpdate`; callers do not need to construct it manually.
 */
export type RunUpdateVesselEventsFromAssemblyInput = {
  pingStartedAt: number;
  tripUpdate: VesselTripUpdate;
  enrichedActiveVesselTrip: ConvexVesselTripWithML;
};

export type RunUpdateVesselEventsOutput = {
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockWriteBatch[];
};
