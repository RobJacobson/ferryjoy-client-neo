import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

export type ArrivalLookupResult = {
  arrivalTerminal?: string;
  scheduledTripDoc?: ConvexScheduledTrip;
};

/**
 * Look up arriving terminal from scheduled trips when vessel arrives at dock
 * without an identified arriving terminal.
 *
 * Matches scheduled trips based on:
 * - Vessel name (VesselAbbrev)
 * - Departing terminal (DepartingTerminalAbbrev)
 * - Scheduled departure (ScheduledDeparture)
 * - Prefers direct trips if both direct and indirect trips match
 *
 * When a match is found, returns both the arriving terminal and the full
 * scheduled trip doc. The caller can reuse the scheduled trip for
 * enrichTripStartUpdates to avoid a second query (getScheduledTripByKey).
 *
 * @param ctx - Convex action context for database queries
 * @param existingTrip - Current vessel trip state
 * @param currLocation - Latest vessel location data
 * @returns Arrival terminal and optional scheduled trip doc, or undefined
 */
export const lookupArrivalTerminalFromSchedule = async (
  ctx: ActionCtx,
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): Promise<ArrivalLookupResult | undefined> => {
  // Only lookup when:
  // 1. Vessel is currently at dock
  // 2. Arriving terminal is missing (both in trip and current location)
  // 3. We have the required fields for lookup
  const isAtDock = currLocation.AtDock;
  const missingArrivingTerminal =
    !existingTrip.ArrivingTerminalAbbrev &&
    !currLocation.ArrivingTerminalAbbrev;
  const hasRequiredFields =
    existingTrip.VesselAbbrev &&
    existingTrip.DepartingTerminalAbbrev &&
    existingTrip.ScheduledDeparture;

  if (!isAtDock || !missingArrivingTerminal || !hasRequiredFields) {
    return undefined;
  }

  // TypeScript guard: we've already checked hasRequiredFields, so this is safe
  if (!existingTrip.ScheduledDeparture) {
    return undefined;
  }

  const queryParams = {
    vesselAbbrev: existingTrip.VesselAbbrev,
    departingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
    scheduledDeparture: existingTrip.ScheduledDeparture,
  };

  try {
    const scheduledTrip = await ctx.runQuery(
      api.functions.scheduledTrips.queries.findScheduledTripForArrivalLookup,
      queryParams
    );

    if (scheduledTrip) {
      const trip = stripConvexMeta(
        scheduledTrip as Record<string, unknown>
      ) as ConvexScheduledTrip;
      return {
        arrivalTerminal: trip.ArrivingTerminalAbbrev,
        scheduledTripDoc: trip,
      };
    }
  } catch (error) {
    // Log error but don't throw - we'll wait for the API to report the terminal
    console.error(
      `[ArrivalTerminalLookup] Failed to lookup arrival terminal for vessel ${existingTrip.VesselAbbrev}:`,
      error
    );
  }

  return undefined;
};
