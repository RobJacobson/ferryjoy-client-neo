/**
 * Re-exports shared handshake types for timeline callers.
 *
 * Canonical definitions live in `domain/vesselOrchestration/shared`.
 */

export type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  TripPingLifecycleOutcome,
  VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
