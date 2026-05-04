/**
 * Canonical Stage A public contracts for the event concern.
 */

import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";
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
