/**
 * Re-exports handshake types from `tickLifecycle` for timeline callers.
 *
 * Canonical definitions live in `domain/vesselOrchestration/tickLifecycle`.
 */

export type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  TripLifecycleApplyOutcome,
  TripTickLifecycleOutcome,
  VesselTripPersistResult,
} from "domain/vesselOrchestration/tickLifecycle";
