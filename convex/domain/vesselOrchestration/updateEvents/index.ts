/**
 * Orchestrator concern updateEvents: direct trip-delta event projection.
 */

export type {
  ProjectEventsFromTripDeltaInput,
  ProjectEventsFromTripDeltaResult,
  UpdateLeaveDockEventPatch,
} from "./contracts";
export {
  buildLeaveDockEventPatch,
  projectEventsFromTripDelta,
} from "./projectEventsFromTripDelta";
