/**
 * Builds {@link TimelineTripComputation} rows for {@link runUpdateVesselTimeline}
 * after trip-table persistence. Encodes persist-only gates as plain fields on
 * each row (Option B); domain does not read Convex.
 */

import type { VesselTripPersistResult } from "domain/vesselOrchestration/shared";
import {
  completedTripBoundaryMatchKeyFromFact,
  isCompletedTripBranchComputation,
  isCurrentTripBranchComputation,
  isPersistedCurrentTripComputation,
  persistedActiveTripKey,
} from "domain/vesselOrchestration/shared/tripComputationPersistMapping";
import type { TimelineTripComputation } from "domain/vesselOrchestration/updateTimeline";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";

/**
 * Filters and annotates Stage C trip computations using the same persist outcome
 * that wrote `vesselTrips` for this tick.
 */
export const buildTimelineTripComputationsForRun = (
  trips: RunUpdateVesselTripsOutput,
  persist: VesselTripPersistResult
): TimelineTripComputation[] => {
  const activeTripKeys = new Set(
    trips.activeTrips.map((trip) => persistedActiveTripKey(trip))
  );
  const successfulVessels = persist.currentBranch.successfulVessels;

  const succeededCompletedKeys = new Set(
    persist.completedFacts.map((f) => completedTripBoundaryMatchKeyFromFact(f))
  );

  const out: TimelineTripComputation[] = [];

  for (const computation of trips.tripComputations) {
    if (isCompletedTripBranchComputation(computation)) {
      const { completedTrip } = computation;
      if (completedTrip === undefined) {
        continue;
      }
      const key = `${completedTrip.VesselAbbrev}::${completedTrip.ScheduleKey}`;
      if (!succeededCompletedKeys.has(key)) {
        continue;
      }
      out.push({ ...computation });
      continue;
    }

    if (isCurrentTripBranchComputation(computation)) {
      const requiresSuccessfulUpsert = isPersistedCurrentTripComputation(
        computation,
        activeTripKeys
      );
      const upsertGatePassed =
        !requiresSuccessfulUpsert ||
        successfulVessels.has(computation.vesselAbbrev);
      out.push({
        ...computation,
        timelinePersist: {
          requiresSuccessfulUpsert,
          upsertGatePassed,
        },
      });
    }
  }

  return out;
};
