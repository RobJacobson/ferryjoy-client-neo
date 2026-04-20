import type { TripUpdateRuntime } from "domain/vesselOrchestration/updateVesselTrips/createTripUpdateRuntime";
import type { CompletedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

type CompletedTripResolution = {
  completedVesselTrip?: ConvexVesselTrip;
  activeVesselTrip?: ConvexVesselTrip;
};

export const finalizeCompletedTrips = async (
  completedTripUpdates: ReadonlyArray<CompletedTripUpdate>,
  runtime: Pick<
    TripUpdateRuntime,
    "buildCompletedTrip" | "buildTripCore" | "buildTripAdapters"
  >
): Promise<ReadonlyArray<CompletedTripResolution>> => {
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

    return {
      activeVesselTrip: update?.existingActiveTrip,
    };
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
