/**
 * Pure mapping from Stage C {@link TripComputation} rows to persist/timeline
 * boundary shapes. Shared by `persistVesselTripWriteSet` (functions) and
 * timeline projection assembly (domain) so the two cannot drift.
 *
 * Callers that run Convex mutations set gates using persist outcomes in
 * functions; this module stays free of `ActionCtx` and mutation names.
 */

import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "domain/vesselOrchestration/shared";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/updateVesselPredictions";
import type { TripComputation } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export const completedTripBoundaryMatchKeyFromFact = (
  fact: Pick<CompletedTripBoundaryFact, "tripToComplete">
): string =>
  `${fact.tripToComplete.VesselAbbrev}::${fact.tripToComplete.ScheduleKey}`;

export const completedTripBoundaryMatchKeyFromCompletedComputation = (
  computation: TripComputation & {
    branch: "completed";
    completedTrip: NonNullable<TripComputation["completedTrip"]>;
  }
): string =>
  `${computation.completedTrip.VesselAbbrev}::${computation.completedTrip.ScheduleKey}`;

export const persistedActiveTripKey = (
  trip: Pick<ConvexVesselTrip, "VesselAbbrev" | "TripKey">
): string => `${trip.VesselAbbrev}::${trip.TripKey ?? "no-trip-key"}`;

export const isCompletedTripBranchComputation = (
  computation: TripComputation
): computation is TripComputation & {
  branch: "completed";
} => computation.branch === "completed";

export const isCurrentTripBranchComputation = (
  computation: TripComputation
): computation is TripComputation & {
  branch: "current";
} => computation.branch === "current";

export const completedFactFromComputationOrThrow = (
  computation: TripComputation & { branch: "completed" }
): CompletedTripBoundaryFact => {
  if (
    computation.existingTrip === undefined ||
    computation.completedTrip === undefined ||
    computation.tripCore.gates === undefined
  ) {
    throw new Error(
      `[VesselTrips] completed trip computation for ${computation.vesselAbbrev} is missing required persistence fields`
    );
  }

  return {
    existingTrip: computation.existingTrip,
    tripToComplete: computation.completedTrip,
    newTripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
      gates: computation.tripCore.gates,
    },
  };
};

export const currentActualMessageFromComputation = (
  computation: TripComputation & { branch: "current" }
): Omit<CurrentTripActualEventMessage, "requiresSuccessfulUpsert"> | null => {
  if (computation.events === undefined) {
    return null;
  }
  if (computation.tripCore.gates === undefined) {
    throw new Error(
      `[VesselTrips] current actual trip computation for ${computation.vesselAbbrev} is missing tripCore.gates`
    );
  }

  return {
    events: computation.events,
    tripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
      gates: computation.tripCore.gates,
    },
    vesselAbbrev: computation.vesselAbbrev,
  };
};

export const currentPredictedMessageFromComputation = (
  computation: TripComputation & { branch: "current" }
): Omit<
  CurrentTripPredictedEventMessage,
  "requiresSuccessfulUpsert"
> | null => {
  if (computation.tripCore.gates === undefined) {
    return null;
  }

  return {
    existingTrip: computation.existingTrip,
    tripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
      gates: computation.tripCore.gates,
    },
    vesselAbbrev: computation.vesselAbbrev,
  };
};

export const isPersistedCurrentTripComputation = (
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
      stripTripPredictionsForStorage(computation.activeTrip)
    )
  );

export const shouldPersistLeaveDockIntent = (
  computation: TripComputation & {
    activeTrip?: NonNullable<TripComputation["activeTrip"]>;
    events?: NonNullable<TripComputation["events"]>;
  },
  activeTripKeys: Set<string>
): computation is TripComputation & {
  activeTrip: NonNullable<TripComputation["activeTrip"]> & {
    LeftDockActual: number;
  };
  events: NonNullable<TripComputation["events"]>;
} =>
  computation.events?.didJustLeaveDock === true &&
  computation.activeTrip?.LeftDockActual !== undefined &&
  isPersistedCurrentTripComputation(computation, activeTripKeys);
