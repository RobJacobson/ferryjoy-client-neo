/**
 * Canonical Stage A public contracts for the timeline concern.
 */

import type { ConvexActualDockEvent } from "domain/events/actual";
import type { ConvexPredictedDockWriteBatch } from "domain/events/predicted";
import type { PredictedTripComputation } from "domain/vesselOrchestration/updateVesselPredictions";
import type { TripComputation } from "domain/vesselOrchestration/updateVesselTrips";

export type ActualDockEventRow = ConvexActualDockEvent;

/**
 * Stage A keeps predicted timeline writes aligned to the current batch-shaped
 * persistence flow. Later stages can narrow this if the public contract shifts
 * from batches to row arrays.
 */
export type PredictedDockEventRow = ConvexPredictedDockWriteBatch;

export type RunUpdateVesselTimelineInput = {
  tickStartedAt: number;
  tripComputations: ReadonlyArray<TripComputation>;
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>;
};

export type RunUpdateVesselTimelineOutput = {
  actualEvents: ActualDockEventRow[];
  predictedEvents: PredictedDockEventRow[];
};
