/**
 * Pure payloads for one trip-tick persistence pass (strip + structural grouping).
 * Convex I/O stays in `functions/vesselOrchestrator/actions` (`applyTripTickMutations`).
 */

import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/updateTimeline";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/updateVesselPredictions/stripTripPredictionsForStorage";
import type {
  PendingLeaveDockEffect,
  VesselTripTick,
} from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripTick";

export type TripTickExecutionPayload = {
  handoffMutations: Array<{
    completedTrip: ReturnType<typeof stripTripPredictionsForStorage>;
    newTrip: ReturnType<typeof stripTripPredictionsForStorage>;
  }>;
  activeUpsertBatch: ReturnType<typeof stripTripPredictionsForStorage>[] | null;
  leaveDockEffects: PendingLeaveDockEffect[];
};

export const buildTripTickExecutionPayloads = (
  tick: VesselTripTick
): TripTickExecutionPayload => ({
  handoffMutations: tick.completedHandoffs.map((f) => ({
    completedTrip: stripTripPredictionsForStorage(f.tripToComplete),
    newTrip: stripTripPredictionsForStorage(f.newTripCore.withFinalSchedule),
  })),
  activeUpsertBatch:
    tick.current.activeUpserts.length > 0
      ? tick.current.activeUpserts.map(stripTripPredictionsForStorage)
      : null,
  leaveDockEffects: tick.current.pendingLeaveDockEffects,
});

/**
 * Successful completed-boundary facts from parallel handoff mutation outcomes.
 */
export const completedFactsForSuccessfulHandoffs = (
  tick: VesselTripTick,
  settled: PromiseSettledResult<unknown>[]
): CompletedTripBoundaryFact[] => {
  const completedFacts: CompletedTripBoundaryFact[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const fact = tick.completedHandoffs[i];
    if (result?.status === "fulfilled" && fact !== undefined) {
      completedFacts.push(fact);
    }
  }
  return completedFacts;
};
