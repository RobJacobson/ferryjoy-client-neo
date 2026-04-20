import type { TripUpdateRuntime } from "domain/vesselOrchestration/updateVesselTrips/createTripUpdateRuntime";
import type { PreparedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export const updateActiveTrips = async (
  activeTripUpdates: ReadonlyArray<PreparedTripUpdate>,
  runtime: Pick<TripUpdateRuntime, "buildTripCore" | "buildTripAdapters">
): Promise<ReadonlyArray<ConvexVesselTrip>> => {
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

  return settled.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    const update = activeTripUpdates[index];
    logTripUpdateError(
      update?.vesselLocation.VesselAbbrev ?? "unknown",
      "updating active trip",
      result.reason
    );

    return update?.existingActiveTrip !== undefined
      ? [update.existingActiveTrip]
      : [];
  });
};

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
