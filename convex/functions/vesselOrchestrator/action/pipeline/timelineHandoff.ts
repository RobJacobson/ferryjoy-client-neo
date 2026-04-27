/**
 * Adapter for timeline handoff shaping from trip writes.
 */

import type { PersistedTripTimelineHandoff } from "domain/vesselOrchestration/shared";
import type { VesselTripWrites } from "./tripWrites";

/**
 * Converts trip writes into the timeline handoff input shape.
 *
 * This adapter exists to decouple timeline projection inputs from internal trip
 * write construction details. It translates sparse trip writes into the
 * timeline assembly contract expected by `updateTimeline`, ensuring the action
 * shell can pass one stable handoff shape regardless of which trip branch
 * produced changes. Keeping the mapping here preserves a clean boundary between
 * trip lifecycle output semantics and timeline projection semantics.
 *
 * @param tripWrites - Sparse trip writes produced for the current vessel
 * @returns Timeline handoff used by the timeline projection stage
 */
export const toTimelineHandoffFromTripWrites = (
  tripWrites: VesselTripWrites
): PersistedTripTimelineHandoff => ({
  // Keep completed facts as array for parity with timeline assembler contract.
  completedTripFacts:
    tripWrites.completedTripWrite === undefined
      ? []
      : [tripWrites.completedTripWrite],
  currentBranch: {
    successfulVesselAbbrev: tripWrites.activeTripUpsert?.VesselAbbrev,
    pendingActualWrite: tripWrites.actualDockWrite,
    pendingPredictedWrite: tripWrites.predictedDockWrite,
  },
});
