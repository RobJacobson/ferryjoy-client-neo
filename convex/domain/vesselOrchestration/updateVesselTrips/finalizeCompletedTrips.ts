/**
 * Completes in-flight trips and projects the next active row per completion update.
 */

import type { TripUpdateRuntime } from "domain/vesselOrchestration/updateVesselTrips/createTripUpdateRuntime";
import type { CompletedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/** One completion tick: closed row plus optional replacement active trip. */
type CompletedTripResolution = {
  completedVesselTrip?: ConvexVesselTrip;
  activeVesselTrip?: ConvexVesselTrip;
};

/**
 * Builds completed trip rows and follow-on active trips; errors keep prior active.
 *
 * @param completedTripUpdates - Vessels whose tick closes a trip
 * @param runtime - Completed-trip builder, trip core, and adapters
 * @returns One resolution per input (fulfilled or fallback with prior active only)
 */
export const finalizeCompletedTrips = async (
  completedTripUpdates: ReadonlyArray<CompletedTripUpdate>,
  runtime: Pick<
    TripUpdateRuntime,
    "buildCompletedTrip" | "buildTripCore" | "buildTripAdapters"
  >
): Promise<ReadonlyArray<CompletedTripResolution>> => {
  // Isolate failures per vessel so one bad row does not drop the whole batch.
  const settled = await Promise.allSettled(
    completedTripUpdates.map(async (update) => {
      const completedVesselTrip = runtime.buildCompletedTrip(
        update.existingActiveTrip,
        update.vesselLocation,
        update.events.didJustArriveAtDock
      );
      const nextActiveTrip = await runtime.buildTripCore(
        update.vesselLocation,
        completedVesselTrip,
        true,
        update.events,
        runtime.buildTripAdapters
      );

      return {
        completedVesselTrip,
        activeVesselTrip: nextActiveTrip.withFinalSchedule,
      };
    })
  );

  return settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    const update = completedTripUpdates[index];
    logTripUpdateError(
      update?.vesselLocation.VesselAbbrev ?? "unknown",
      "finalizing completed trip",
      result.reason
    );

    // Preserve the last known active row so downstream merge can still converge.
    return {
      activeVesselTrip: update?.existingActiveTrip,
    };
  });
};

/**
 * Logs a per-vessel pipeline failure without throwing.
 *
 * @param vesselAbbrev - Vessel id for the failed row
 * @param phase - Human-readable pipeline stage label
 * @param error - Rejection reason from `Promise.allSettled`
 */
const logTripUpdateError = (
  vesselAbbrev: string,
  phase: string,
  error: unknown
): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    `[VesselTrips] Failed ${phase} for ${vesselAbbrev}: ${err.message}`,
    err
  );
};
