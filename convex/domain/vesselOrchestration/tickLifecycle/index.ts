/**
 * Public entry for orchestrator tick handshake types: lifecycle facts/messages,
 * persist vs timeline labels, and projection wire shapes (`TickEventWrites`).
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
  TripLifecycleApplyOutcome,
  TripTickLifecycleOutcome,
  VesselTripPersistResult,
} from "./types";
