import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { toConvexVesselLocation } from "functions/vesselLocation/schemas";
import { runUpdateVesselTrips } from "functions/vesselTrips/updates";
import { convertConvexVesselLocation } from "shared/convertVesselLocations";
import { calculateTimeDelta } from "shared/durationUtils";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";

/**
 * Orchestrator action that fetches vessel locations once and delegates to both
 * updateVesselLocations and updateVesselTrips subroutines with robust error isolation.
 *
 * This action eliminates duplicate API calls by fetching vessel locations once,
 * then passing the same deduplicated data to both processing functions. Failures
 * in one function do not prevent the other from executing.
 *
 * Flow:
 * 1. Fetch vessel locations via fetchVesselLocations()
 * 2. Convert: toConvexVesselLocation() → convertConvexVesselLocation()
 * 3. Deduplicate using shared utility
 * 4. Call updateVesselLocations() with error isolation
 * 5. Call runUpdateVesselTrips() with error isolation
 *
 * @param ctx - Convex action context
 * @returns Result object indicating success/failure of each subroutine
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  handler: async (ctx) => {
    let locationsSuccess = false;
    let tripsSuccess = false;
    const errors: {
      locations?: { message: string; stack?: string };
      trips?: { message: string; stack?: string };
    } = {};

    // Fetch and convert vessel locations
    let deduplicatedLocations: ConvexVesselLocation[] = [];

    try {
      const rawLocations =
        (await fetchVesselLocations()) as unknown as DottieVesselLocation[];

      const convexLocations = rawLocations
        .map(toConvexVesselLocation)
        .map(convertConvexVesselLocation);

      deduplicatedLocations = dedupeVesselLocationsByTimestamp(convexLocations);
    } catch (error) {
      console.error("Failed to fetch or process vessel locations:", error);
      // If fetch fails, both subroutines will fail, but we still want to attempt them
      // with empty array to maintain error isolation structure
    }

    // Validate raw vessel locations for early departure anomalies (departed >10 min before scheduled).
    // This helps detect API data mismatches where a vessel's scheduled departure
    // doesn't match its actual departure time.
    validateVesselLocationsForEarlyDeparture(deduplicatedLocations);

    // Call updateVesselLocations subroutine with error isolation
    try {
      await updateVesselLocations(ctx, deduplicatedLocations);
      locationsSuccess = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.locations = { message: err.message, stack: err.stack };
      console.error("updateVesselLocations failed:", err);
    }

    // Call runUpdateVesselTrips subroutine with error isolation
    try {
      await runUpdateVesselTrips(ctx, deduplicatedLocations);
      tripsSuccess = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.trips = { message: err.message, stack: err.stack };
      console.error("runUpdateVesselTrips failed:", err);
    }

    return {
      locationsSuccess,
      tripsSuccess,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    };
  },
});

/**
 * Deduplicates vessel locations by vessel, keeping only the most recent location per vessel.
 *
 * Sorts locations by timestamp (oldest first), then reduces to a map keyed by vessel abbreviation.
 * Since we process oldest-to-newest, the newest record for each vessel overwrites prior ones,
 * ensuring we keep only the most recent location per vessel.
 *
 * @param locations - Array of vessel locations to deduplicate
 * @returns Array of deduplicated locations, one per vessel with most recent timestamp
 */
export const dedupeVesselLocationsByTimestamp = (
  locations: ConvexVesselLocation[]
): ConvexVesselLocation[] => {
  const sortedOldestFirst = [...locations].sort(
    (a, b) => a.TimeStamp - b.TimeStamp
  );

  const byVessel = sortedOldestFirst.reduce<
    Record<string, ConvexVesselLocation>
  >((acc, location) => {
    // Oldest-to-newest ordering means the newest record overwrites prior ones.
    acc[location.VesselAbbrev] = location;
    return acc;
  }, {});

  return Object.values(byVessel);
};

/**
 * Subroutine function for updating vessel locations in the database.
 *
 * Stores vessel locations to the database using bulk upsert mutation.
 * This is called as a subroutine within the orchestrator action.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to store
 */
async function updateVesselLocations(
  ctx: ActionCtx,
  locations: ConvexVesselLocation[]
): Promise<void> {
  await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
    locations,
  });
}

/**
 * Validate raw vessel locations for early departure anomalies.
 *
 * Detects cases where a vessel departed significantly before its scheduled departure time,
 * which may indicate API data mismatches or incorrect trip assignments.
 *
 * @param locations - Array of vessel locations to validate
 */
function validateVesselLocationsForEarlyDeparture(
  locations: ConvexVesselLocation[]
): void {
  locations.forEach((location) => {
    // Only check if we have both LeftDock and ScheduledDeparture
    if (!location.LeftDock || !location.ScheduledDeparture) {
      return;
    }

    // Calculate departure delay in minutes (LeftDock - ScheduledDeparture)
    const departureDelay = calculateTimeDelta(
      location.ScheduledDeparture,
      location.LeftDock
    );

    // If vessel departed more than 10 minutes before scheduled time, log error
    if (departureDelay !== undefined && departureDelay < -10) {
      console.error(
        `[VesselOrchestrator] EARLY DEPARTURE ANOMALY DETECTED: Vessel ${location.VesselAbbrev} departed ${Math.abs(departureDelay).toFixed(1)} minutes BEFORE scheduled time.`,
        {
          vesselAbbrev: location.VesselAbbrev,
          vesselName: location.VesselName,
          departingTerminal: location.DepartingTerminalAbbrev,
          arrivingTerminal: location.ArrivingTerminalAbbrev,
          scheduledDeparture: location.ScheduledDeparture
            ? new Date(location.ScheduledDeparture).toISOString()
            : undefined,
          actualDeparture: location.LeftDock
            ? new Date(location.LeftDock).toISOString()
            : undefined,
          departureDelayMinutes: departureDelay,
          timestamp: new Date(location.TimeStamp).toISOString(),
          atDock: location.AtDock,
          inService: location.InService,
          completeLocation: location,
        }
      );
    }
  });
}
