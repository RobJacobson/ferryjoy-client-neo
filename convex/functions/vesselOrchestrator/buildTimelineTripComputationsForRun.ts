/**
 * Builds {@link TimelineTripComputation} rows for {@link runUpdateVesselTimeline}
 * after trip-table persistence. Encodes persist-only gates as plain fields on
 * each row (Option B); domain does not read Convex.
 */

import type { VesselTripPersistResult } from "domain/vesselOrchestration/shared";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/shared";
import type { TimelineTripComputation } from "domain/vesselOrchestration/updateTimeline";
import type { TripComputation } from "domain/vesselOrchestration/shared";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";

const completedTripBoundaryMatchKeyFromFact = (
  vesselAbbrev: string,
  scheduleKey: string | undefined
): string => `${vesselAbbrev}::${scheduleKey}`;

const persistedActiveTripKey = (
  vesselAbbrev: string,
  tripKey: string | undefined
): string => `${vesselAbbrev}::${tripKey ?? "no-trip-key"}`;

const isCompletedTripBranchComputation = (
  computation: TripComputation
): computation is TripComputation & {
  branch: "completed";
} => computation.branch === "completed";

const isCurrentTripBranchComputation = (
  computation: TripComputation
): computation is TripComputation & {
  branch: "current";
} => computation.branch === "current";

const isPersistedCurrentTripComputation = (
  computation: TripComputation & {
    activeTrip?: NonNullable<TripComputation["activeTrip"]>;
  },
  activeTripKeys: Set<string>
): computation is TripComputation & {
  activeTrip: NonNullable<TripComputation["activeTrip"]>;
} =>
  computation.activeTrip !== undefined &&
  activeTripKeys.has(
    persistedActiveTripKey(
      computation.activeTrip.VesselAbbrev,
      stripTripPredictionsForStorage(computation.activeTrip).TripKey
    )
  );

/**
 * Filters and annotates Stage C trip computations using the same persist outcome
 * that wrote `vesselTrips` for this tick.
 */
export const buildTimelineTripComputationsForRun = (
  trips: RunUpdateVesselTripsOutput,
  tripComputations: ReadonlyArray<TripComputation>,
  persist: VesselTripPersistResult
): TimelineTripComputation[] => {
  const activeTripKeys = new Set(
    trips.activeTrips.map((trip) =>
      persistedActiveTripKey(trip.VesselAbbrev, trip.TripKey)
    )
  );
  const successfulVessels = persist.currentBranch.successfulVessels;

  const succeededCompletedKeys = new Set(
    persist.completedFacts.map((fact) =>
      completedTripBoundaryMatchKeyFromFact(
        fact.tripToComplete.VesselAbbrev,
        fact.tripToComplete.ScheduleKey
      )
    )
  );

  const out: TimelineTripComputation[] = [];

  for (const computation of tripComputations) {
    if (isCompletedTripBranchComputation(computation)) {
      const { completedTrip } = computation;
      if (completedTrip === undefined) {
        continue;
      }
      const key = completedTripBoundaryMatchKeyFromFact(
        completedTrip.VesselAbbrev,
        completedTrip.ScheduleKey
      );
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
