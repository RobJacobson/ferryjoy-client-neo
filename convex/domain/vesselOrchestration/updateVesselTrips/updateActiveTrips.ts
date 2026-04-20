/**
 * Projects active trip rows for vessels that are not completing this tick.
 */

import type { TripUpdateRuntime } from "domain/vesselOrchestration/updateVesselTrips/createTripUpdateRuntime";
import type { PreparedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Builds updated active trips from prepared rows; failures fall back to prior active.
 *
 * @param activeTripUpdates - Non-completing prepared updates in feed order
 * @param runtime - Trip core builder and schedule adapters
 * @returns One row per successful update; prior active row kept on failure when present
 */
export const updateActiveTrips = async (
  activeTripUpdates: ReadonlyArray<PreparedTripUpdate>,
  runtime: Pick<TripUpdateRuntime, "buildTripCore" | "buildTripAdapters">
): Promise<ReadonlyArray<ConvexVesselTrip>> => {
  // Isolate failures per vessel so one bad row does not drop the whole batch.
  const settled = await Promise.allSettled(
    activeTripUpdates.map(async (update) => {
      const nextActiveTrip = await runtime.buildTripCore(
        update.vesselLocation,
        update.existingActiveTrip,
        false,
        update.events,
        runtime.buildTripAdapters
      );

      return nextActiveTrip.withFinalSchedule;
    })
  );

  // Per-index: fulfilled value or log + optional carry-forward of the prior active row.
  return settled.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    const update = activeTripUpdates[index];
    // Surface the failure; caller still gets a stable row when `existingActiveTrip` exists.
    logTripUpdateError(
      update?.vesselLocation.VesselAbbrev ?? "unknown",
      "updating active trip",
      result.reason
    );

    // Same fallback as finalize: keep last good active row when build throws.
    return update?.existingActiveTrip !== undefined
      ? [update.existingActiveTrip]
      : [];
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
