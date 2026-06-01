/**
 * Public contracts for direct trip-delta event projection.
 */

import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";

/**
 * Optional leave-dock ML patch forwarded through persistVesselUpdates.
 */
type UpdateLeaveDockEventPatch = {
  vesselAbbrev: string;
  depBoundaryKey: string;
  actualDepartMs: number;
};

/**
 * Input for direct event projection from one sparse trip update.
 */
type ProjectEventsFromTripDeltaInput = {
  pingStartedAt: number;
  tripUpdate: VesselTripUpdate;
  enrichedActiveVesselTrip: ConvexVesselTripWithML;
};

/**
 * Persistence-ready event rows and optional leave-dock patch for one vessel ping.
 */
type ProjectEventsFromTripDeltaResult = {
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockWriteBatch[];
  updateLeaveDockEventPatch?: UpdateLeaveDockEventPatch;
};

export type {
  ProjectEventsFromTripDeltaInput,
  ProjectEventsFromTripDeltaResult,
  UpdateLeaveDockEventPatch,
};
