/**
 * Canonical Stage A public contracts for the timeline concern.
 */

import type { ConvexActualDockEvent } from "domain/events/actual";
import type { ConvexPredictedDockWriteBatch } from "domain/events/predicted";
import type { PredictedTripComputation } from "domain/vesselOrchestration/shared";
import type { TripComputation } from "domain/vesselOrchestration/shared";

/**
 * Post-persist metadata for orchestrator timeline (Option B). Set in
 * `convex/functions/vesselOrchestrator` after `persistVesselTripWriteSet`; domain
 * treats these as plain input facts (no Convex reads).
 */
export type TimelineTripComputationPersist = {
  /**
   * Whether timeline rows tied to the active-trip batch upsert must wait for a
   * successful upsert (mirrors `isPersistedCurrentTripComputation` in persist).
   */
  requiresSuccessfulUpsert?: boolean;
  /**
   * `!requiresSuccessfulUpsert || successfulVessels.has(vesselAbbrev)` from the
   * same persist pass that wrote trip tables.
   */
  upsertGatePassed?: boolean;
};

/**
 * Stage C {@link TripComputation} plus orchestrator-only persist gates for one
 * timeline run. Does not widen the Stage C contract on `TripComputation` itself.
 */
export type TimelineTripComputation = TripComputation & {
  timelinePersist?: TimelineTripComputationPersist;
};

export type ActualDockEventRow = ConvexActualDockEvent;

/**
 * Stage A keeps predicted timeline writes aligned to the current batch-shaped
 * persistence flow. Later stages can narrow this if the public contract shifts
 * from batches to row arrays.
 */
export type PredictedDockEventRow = ConvexPredictedDockWriteBatch;

export type RunUpdateVesselTimelineInput = {
  tickStartedAt: number;
  tripComputations: ReadonlyArray<TimelineTripComputation>;
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>;
};

export type RunUpdateVesselTimelineOutput = {
  actualEvents: ActualDockEventRow[];
  predictedEvents: PredictedDockEventRow[];
};
