/**
 * Shared handshake DTOs and projection-wire shapes used across orchestrator
 * phases after trip persistence and ML overlay.
 */

export {
  mergePingEventWrites,
  type PingEventWrites,
  type TimelinePingProjectionInput,
} from "./projectionWire";
export type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  TripPingLifecycleOutcome,
  VesselTripPersistResult,
} from "./types";
