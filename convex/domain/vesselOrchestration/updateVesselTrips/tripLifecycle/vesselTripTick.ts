/**
 * One vessel-orchestrator tick of trip work: completed handoffs and
 * current-branch artifacts. The functions layer runs Convex mutations from this
 * value; {@link buildTimelineTickProjectionInput} runs only after apply
 * (orchestrator trip branch).
 */

import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "domain/vesselOrchestration/updateTimeline/types";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";

/**
 * Leave-dock backfill queued during current-trip processing; runs only after a
 * successful active-trip upsert for that vessel.
 */
export type PendingLeaveDockEffect = {
  vesselAbbrev: string;
  trip: ConvexVesselTripWithPredictions;
};

/**
 * Pre-mutation state for the active-trip branch: batch upsert candidates,
 * timeline messages, and leave-dock intents.
 */
export type CurrentTripTickFragment = {
  /** Schedule-shaped rows from {@link buildTripCore} (ML stripped at upsert). */
  activeUpserts: ConvexVesselTripWithPredictions[];
  pendingActualMessages: CurrentTripActualEventMessage[];
  pendingPredictedMessages: CurrentTripPredictedEventMessage[];
  pendingLeaveDockEffects: PendingLeaveDockEffect[];
};

/**
 * Full tick: completed-boundary builds (successful only) plus current
 * artifacts. Mutation payloads are derived at apply time (strip once in applier).
 */
export type VesselTripTick = {
  /** Successful boundary handoffs only, stable tick input order. */
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
  current: CurrentTripTickFragment;
};
