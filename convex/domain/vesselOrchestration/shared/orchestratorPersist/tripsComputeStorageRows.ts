/**
 * Strip predictions and group {@link VesselTripsComputeBundle} into storage-shaped
 * rows for handoffs, active batch, and leave-dock effects. Convex I/O is performed
 * via `persistVesselTripWriteSet` and {@link VesselTripTableMutations}.
 */

import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/shared";
import type {
  PendingLeaveDockEffect,
  VesselTripsComputeBundle,
} from "domain/vesselOrchestration/shared";
import { stripTripPredictionsForStorage } from "../stripTripPredictionsForStorage";

export type TripsComputeStorageRows = {
  handoffMutations: Array<{
    completedTrip: ReturnType<typeof stripTripPredictionsForStorage>;
    newTrip: ReturnType<typeof stripTripPredictionsForStorage>;
  }>;
  activeUpsertBatch: ReturnType<typeof stripTripPredictionsForStorage>[] | null;
  leaveDockEffects: PendingLeaveDockEffect[];
};

export const buildTripsComputeStorageRows = (
  tripsCompute: VesselTripsComputeBundle
): TripsComputeStorageRows => ({
  handoffMutations: tripsCompute.completedHandoffs.map((f) => ({
    completedTrip: stripTripPredictionsForStorage(f.tripToComplete),
    newTrip: stripTripPredictionsForStorage(f.scheduleTrip),
  })),
  activeUpsertBatch:
    tripsCompute.current.activeUpserts.length > 0
      ? tripsCompute.current.activeUpserts.map(stripTripPredictionsForStorage)
      : null,
  leaveDockEffects: tripsCompute.current.pendingLeaveDockEffects,
});

/**
 * Successful completed-boundary facts from parallel handoff mutation outcomes.
 */
export const completedFactsForSuccessfulHandoffs = (
  tripsCompute: VesselTripsComputeBundle,
  settled: PromiseSettledResult<unknown>[]
): CompletedTripBoundaryFact[] => {
  const completedFacts: CompletedTripBoundaryFact[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const fact = tripsCompute.completedHandoffs[i];
    if (result?.status === "fulfilled" && fact !== undefined) {
      completedFacts.push(fact);
    }
  }
  return completedFacts;
};
