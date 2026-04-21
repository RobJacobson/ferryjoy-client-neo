/**
 * Vessel-orchestrator trip persistence: apply one functions-owned translation
 * from the public trips DTOs to Convex mutations.
 *
 * The trips concern owns the public trip-computation contract. This module owns
 * only the one-way translation needed to persist those outputs through
 * `ActionCtx`-backed mutation bindings.
 */

import type {
  VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/shared";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type VesselTripUpsertBatchResult = {
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
};

/**
 * Convex trip-table bindings for one persist pass. `activeUpserts` is mutable
 * because generated mutation args are not `readonly`.
 */
export type VesselTripTableMutations = {
  completeAndStartNewTrip: (args: {
    completedTrip: ConvexVesselTrip;
    newTrip: ConvexVesselTrip;
  }) => Promise<unknown>;
  upsertVesselTripsBatch: (args: {
    activeUpserts: ConvexVesselTrip[];
  }) => Promise<VesselTripUpsertBatchResult>;
  setDepartNextActualsForMostRecentCompletedTrip: (args: {
    vesselAbbrev: string;
    actualDepartMs: number;
  }) => Promise<unknown>;
};

/**
 * Persists one tick of trip-table writes from the canonical trips domain output.
 */
export const persistVesselTripWriteSet = async (
  tripRows: RunUpdateVesselTripsOutput,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  mutations: VesselTripTableMutations
): Promise<VesselTripPersistResult> => {
  const existingByVessel = new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const completedTripsByVessel = new Map(
    tripRows.completedTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  const completedSettled = await Promise.allSettled(
    [...completedTripsByVessel.entries()].flatMap(([vesselAbbrev, completedTrip]) => {
      const replacementTrip = replacementActiveTripForCompletedVessel(
        tripRows.activeTrips,
        completedTrip
      );
      // Skip malformed completion pairs so one bad vessel does not block the ping.
      if (replacementTrip === undefined) {
        console.error(
          `[VesselTrips] Skip completion for ${vesselAbbrev}: missing replacement active trip`
        );
        return [];
      }
      return [
        mutations.completeAndStartNewTrip({
          completedTrip: stripTripPredictionsForStorage(completedTrip),
          newTrip: stripTripPredictionsForStorage(replacementTrip),
        }),
      ];
    })
  );

  for (const result of completedSettled) {
    if (result.status === "rejected") {
      const err =
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason));
      console.error(`[VesselTrips] Failed completed-trip processing: ${err.message}`, err);
    }
  }

  const activeTripUpserts = tripRows.activeTrips
    .filter((trip) => !completedTripsByVessel.has(trip.VesselAbbrev))
    .map(stripTripPredictionsForStorage)
    // Skip active writes when the storage row is unchanged from the snapshot.
    .filter((nextTrip) => {
      const existingTrip = existingByVessel.get(nextTrip.VesselAbbrev);
      return !areStorageRowsEqual(existingTrip, nextTrip);
    });

  let successfulVessels = new Set<string>();
  if (activeTripUpserts.length > 0) {
    successfulVessels = successfulVesselAbbrevsFromUpsert(
      await mutations.upsertVesselTripsBatch({
        activeUpserts: [...activeTripUpserts],
      })
    );
  }

  return {
    // Return empty timeline/prediction handoffs until Step 3 is arrays-only.
    completedFacts: [],
    currentBranch: {
      successfulVessels,
      pendingActualMessages: [],
      pendingPredictedMessages: [],
    },
  };
};

/**
 * Finds the replacement active trip for one completed trip rollover.
 */
const replacementActiveTripForCompletedVessel = (
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  completedTrip: ConvexVesselTrip
): ConvexVesselTrip | undefined =>
  activeTrips.find(
    (activeTrip) =>
      activeTrip.VesselAbbrev === completedTrip.VesselAbbrev &&
      activeTrip.TripKey !== completedTrip.TripKey
  );

/**
 * Compares persisted trip-row shapes to suppress redundant active upserts.
 */
const areStorageRowsEqual = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): boolean => {
  if (existingTrip === undefined) {
    return false;
  }
  const existingStorageTrip = stripTripPredictionsForStorage(existingTrip);
  const nextStorageTrip = stripTripPredictionsForStorage(nextTrip);
  return JSON.stringify(existingStorageTrip) === JSON.stringify(nextStorageTrip);
};

const successfulVesselAbbrevsFromUpsert = (
  upsertResult: VesselTripUpsertBatchResult
): Set<string> =>
  new Set(
    upsertResult.perVessel
      .filter((result) => {
        if (result.ok) {
          return true;
        }

        console.error(
          `[VesselTrips] Failed active-trip upsert for ${result.vesselAbbrev}: ${
            result.reason ?? "unknown error"
          }`
        );
        return false;
      })
      .map((result) => result.vesselAbbrev)
  );

