/**
 * Shared handshake DTOs and projection-wire shapes used across orchestrator
 * phases after trip persistence and ML overlay.
 */

export {
  mergeTickEventWrites,
  type TickEventWrites,
  type TimelineTickProjectionInput,
} from "./projectionWire";
export type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  TripTickLifecycleOutcome,
  VesselTripPersistResult,
} from "./types";
