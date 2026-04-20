/**
 * Strip predictions and group {@link VesselTripsComputeBundle} into storage-shaped
 * rows for handoffs, active batch, and leave-dock effects. Convex I/O is performed
 * via `persistVesselTripWriteSet` and {@link VesselTripTableMutations}.
 */

import type {
  PendingLeaveDockEffect,
  VesselTripsComputeBundle,
} from "domain/vesselOrchestration/shared";
import { stripTripPredictionsForStorage } from "../stripTripPredictionsForStorage";

type TripsComputeStorageRows = {
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

