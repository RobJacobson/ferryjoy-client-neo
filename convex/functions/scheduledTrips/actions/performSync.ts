import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { ConvexError } from "convex/values";
import { generateTripKey } from "shared";
import type { Route, Schedule, TerminalCombo } from "ws-dottie/wsf-schedule";
import {
  fetchRoutesByTripDate,
  fetchScheduleByTripDateAndRouteId,
} from "ws-dottie/wsf-schedule";
import { formatPacificDate } from "../../../shared/keys";
import type { ConvexScheduledTrip } from "../schemas";
import { getTerminalAbbreviation, getVesselAbbreviation } from "../schemas";
import type { DaySyncResult, VesselSailing } from "./types";

/**
 * Configuration constants for scheduled trips operations.
 */
const CONFIG = {
  /** Delay in milliseconds before retrying failed external API calls */
  RETRY_DELAY_MS: 5000,
} as const;

/**
 * Creates a complete scheduled trip record directly from WSF API data.
 * Generates the composite key and resolves all abbreviations in one step.
 *
 * @param sailing - Raw vessel sailing data from WSF API
 * @param terminalCombo - Terminal combination with route details
 * @param route - Route information from WSF API
 * @param tripDate - Trip date in YYYY-MM-DD format
 * @returns Complete scheduled trip record ready for Convex storage, or null if invalid
 */
const createScheduledTrip = (
  sailing: VesselSailing,
  terminalCombo: TerminalCombo,
  route: Route,
  tripDate: string
): ConvexScheduledTrip | null => {
  // Extract annotations by mapping indexes to the terminal combo's annotation array
  const annotations = sailing.AnnotationIndexes
    ? sailing.AnnotationIndexes.filter(
        (index) => index < terminalCombo.Annotations.length
      ).map((index) => terminalCombo.Annotations[index])
    : [];

  // Resolve full names to standard WSF abbreviations
  const vesselAbbrev = getVesselAbbreviation(sailing.VesselName);
  const departingTerminalAbbrev = getTerminalAbbreviation(
    terminalCombo.DepartingTerminalName
  );
  const arrivingTerminalAbbrev = getTerminalAbbreviation(
    terminalCombo.ArrivingTerminalName
  );

  // Reject trips with missing abbreviations to maintain data integrity
  if (!vesselAbbrev || !departingTerminalAbbrev || !arrivingTerminalAbbrev) {
    console.warn(`Skipping trip due to missing abbreviations:`, {
      vessel: sailing.VesselName,
      departing: terminalCombo.DepartingTerminalName,
      arriving: terminalCombo.ArrivingTerminalName,
    });
    return null;
  }

  // Generate the composite key that uniquely identifies this trip
  const key = generateTripKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    sailing.DepartingTime
  );

  if (!key) {
    throw new Error(
      `Failed to generate key for scheduled trip: ${vesselAbbrev}-${departingTerminalAbbrev}-${arrivingTerminalAbbrev}`
    );
  }

  const trip: ConvexScheduledTrip = {
    VesselAbbrev: vesselAbbrev,
    DepartingTerminalAbbrev: departingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    DepartingTime: sailing.DepartingTime.getTime(),
    ArrivingTime: sailing.ArrivingTime
      ? sailing.ArrivingTime.getTime()
      : undefined,
    SailingNotes: terminalCombo.SailingNotes,
    Annotations: annotations,
    RouteID: route.RouteID,
    RouteAbbrev: route.RouteAbbrev || "",
    Key: key,
    SailingDay: tripDate,
  };

  return trip;
};

/**
 * Filters out indirect/overlapping trips using a two-pointer chronological scan.
 * For multi-stage vessel trips, WSF API reports multiple destination options from the same
 * departure point. This function scans chronologically and uses lookahead to identify
 * which destination matches the vessel's actual next departure terminal.
 *
 * Algorithm:
 * 1. Group trips by vessel and sailing day, sort chronologically
 * 2. Scan through trips with two pointers (current + lookahead)
 * 3. When overlapping departures found, check next trip's departure terminal
 * 4. Keep only trips where arrival terminal matches next departure terminal
 *
 * @param trips - Array of scheduled trip records to filter
 * @returns Filtered array with chronologically correct trips only
 */
const filterOverlappingTrips = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  // Group trips by vessel (across all routes and days for proper network traversal)
  const tripsByVessel = trips.reduce(
    (acc, trip) => {
      acc[trip.VesselAbbrev] ??= [];
      acc[trip.VesselAbbrev].push(trip);
      return acc;
    },
    {} as Record<string, ConvexScheduledTrip[]>
  );

  const filteredTrips: ConvexScheduledTrip[] = [];

  // Process each vessel across its entire network traversal
  for (const vesselTrips of Object.values(tripsByVessel)) {
    if (vesselTrips.length === 0) continue;

    // Sort chronologically by departure time
    vesselTrips.sort((a, b) => a.DepartingTime - b.DepartingTime);

    let i = 0;
    while (i < vesselTrips.length) {
      // Find all trips with same departure time and terminal (overlapping group)
      const currentTrip = vesselTrips[i];
      const overlappingTrips: ConvexScheduledTrip[] = [];

      // Collect all trips with same departure time and terminal
      while (
        i < vesselTrips.length &&
        vesselTrips[i].DepartingTime === currentTrip.DepartingTime &&
        vesselTrips[i].DepartingTerminalAbbrev ===
          currentTrip.DepartingTerminalAbbrev
      ) {
        overlappingTrips.push(vesselTrips[i]);
        i++;
      }

      if (overlappingTrips.length === 1) {
        // Single trip - keep it
        filteredTrips.push(overlappingTrips[0]);
      } else {
        // Multiple overlapping trips - find which one matches next departure terminal
        // Look ahead to find where this vessel departs from next
        let nextDepartureTerminal: string | undefined;

        // Scan forward from current position to find next different departure terminal
        for (let j = i; j < vesselTrips.length; j++) {
          const nextTrip = vesselTrips[j];
          // Skip trips with same departure time (part of current overlapping group)
          if (nextTrip.DepartingTime === currentTrip.DepartingTime) continue;

          // Found next departure - this terminal is where vessel goes next
          nextDepartureTerminal = nextTrip.DepartingTerminalAbbrev;
          break;
        }

        if (nextDepartureTerminal) {
          // Keep only the trip that goes to the next departure terminal
          const correctTrip = overlappingTrips.find(
            (trip) => trip.ArrivingTerminalAbbrev === nextDepartureTerminal
          );

          if (correctTrip) {
            filteredTrips.push(correctTrip);
          } else {
            // Fallback: no trip matches expected next terminal
            // This can happen with irregular schedules - keep all options
            console.warn(
              `No overlapping trip goes to expected next terminal ${nextDepartureTerminal} ` +
                `for vessel ${currentTrip.VesselAbbrev} departing ${currentTrip.DepartingTerminalAbbrev} ` +
                `at ${new Date(currentTrip.DepartingTime).toISOString()}`
            );
            filteredTrips.push(...overlappingTrips);
          }
        } else {
          // No next departure found (end of vessel's schedule) - keep all options
          filteredTrips.push(...overlappingTrips);
        }
      }
    }
  }

  return filteredTrips;
};

/**
 * Flattens complete WSF schedule data into individual scheduled trip records.
 * Converts WSF API responses into structured trip data ready for database storage.
 * Includes filtering to resolve overlapping/ambiguous ferry routes.
 *
 * @param schedule - Complete schedule data from WSF API for one route and date
 * @param route - Route metadata (ID, abbreviation) from WSF API
 * @param tripDate - Trip date in YYYY-MM-DD format (becomes SailingDay in stored data)
 * @returns Array of scheduled trip records ready for Convex database insertion
 */
const flattenScheduleToTrips = (
  schedule: Schedule,
  route: Route,
  tripDate: string
): ConvexScheduledTrip[] => {
  const rawTrips = schedule.TerminalCombos.flatMap((terminalCombo) =>
    (terminalCombo.Times as VesselSailing[])
      .map((vesselSailing) =>
        createScheduledTrip(vesselSailing, terminalCombo, route, tripDate)
      )
      .filter((trip): trip is ConvexScheduledTrip => trip !== null)
  );

  // Apply business logic filtering to resolve overlapping routes
  return filterOverlappingTrips(rawTrips);
};

/**
 * Simple retry utility for external API calls with exponential backoff.
 * Implements a single retry with fixed delay to handle transient network issues.
 * Used for all WSF API calls to improve reliability.
 *
 * @param fn - Async function to retry on failure
 * @returns Result of the function call (either first attempt or retry)
 * @throws Last error encountered if both attempts fail
 */
const retryOnce = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.warn("API call failed, retrying once:", error);
    // Fixed delay retry - simple and predictable for external API calls
    await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
    return await fn();
  }
};

/**
 * Fetches detailed schedule data for a specific route and trip date from WSF API.
 * Retrieves all terminal combinations, times, and annotations for the given route.
 * This is the core data source for scheduled trip information.
 *
 * @param routeId - WSF route identifier (e.g., 1 for Seattle-Bainbridge)
 * @param tripDate - Trip date in YYYY-MM-DD format (WSF operational day)
 * @returns Complete schedule data including terminal combinations and vessel times
 * @throws Error if WSF API call fails after retry attempts
 */
const fetchRouteSchedule = async (
  routeId: number,
  tripDate: string
): Promise<Schedule> => {
  return await retryOnce(() =>
    fetchScheduleByTripDateAndRouteId({
      params: {
        TripDate: tripDate,
        RouteID: routeId,
      },
    })
  );
};

/**
 * Simplified sync function that downloads fresh data before deleting existing data.
 * This approach ensures we never lose all data due to network errors.
 *
 * Process:
 * 1. Fetch all active routes for the target date
 * 2. Download fresh schedule data for all routes (fail fast if any download fails)
 * 3. Only after successful download, delete all existing trips for the target date
 * 4. Insert all the fresh downloaded data
 *
 * @param ctx - Convex action context for database operations
 * @param targetDate - Target trip date in YYYY-MM-DD format to synchronize
 * @param logPrefix - Prefix for log messages
 * @returns Summary of the sync operation
 */
export const syncScheduledTripsForDate = async (
  ctx: ActionCtx,
  targetDate: string,
  logPrefix: string = ""
): Promise<{
  deleted: number;
  inserted: number;
  routesProcessed: number;
  totalFiltered: number;
}> => {
  try {
    console.log(
      `${logPrefix}Starting SAFE scheduled trips sync for ${targetDate}`
    );

    // Phase 1: Fetch all active routes
    console.log(`${logPrefix}Fetching routes for ${targetDate}`);
    const routes: Route[] = await retryOnce(() =>
      fetchRoutesByTripDate({ params: { TripDate: targetDate } })
    );
    console.log(
      `${logPrefix}Found ${routes.length} routes:`,
      routes
        .map((r) => `${r.RouteID} (${r.RouteAbbrev || "no abbrev"})`)
        .join(", ")
    );

    if (routes.length === 0) {
      console.log(`${logPrefix}No routes found for ${targetDate}`);
      return { deleted: 0, inserted: 0, routesProcessed: 0, totalFiltered: 0 };
    }

    // Phase 2: Download ALL fresh data before making any changes
    console.log(`${logPrefix}Downloading fresh data for all routes`);
    const routeData: {
      route: Route;
      trips: ConvexScheduledTrip[];
      rawTripCount: number;
    }[] = [];

    for (const route of routes) {
      console.log(
        `${logPrefix}Downloading route ${route.RouteID} (${route.RouteAbbrev || "no abbrev"})`
      );

      // Fetch schedule data
      const schedule = await fetchRouteSchedule(route.RouteID, targetDate);

      // Convert to trips (raw data only, skip filtering)
      const rawTripCount = schedule.TerminalCombos.flatMap(
        (terminalCombo) => (terminalCombo.Times as VesselSailing[]).length
      ).reduce((sum, count) => sum + count, 0);

      const routeTrips = flattenScheduleToTrips(schedule, route, targetDate);

      console.log(
        `${logPrefix}Route ${route.RouteID} downloaded ${routeTrips.length} raw trips ` +
          `(from ${rawTripCount} API entries)`
      );

      routeData.push({ route, trips: routeTrips, rawTripCount });
    }

    // Combine all trips from all routes
    const allRawTrips = routeData.flatMap((data) => data.trips);
    console.log(
      `${logPrefix}Applying vessel-level filtering to ${allRawTrips.length} total trips across all routes`
    );

    // Apply vessel-level filtering to resolve overlapping routes across all terminals
    const finalTrips = filterOverlappingTrips(allRawTrips);
    const totalFiltered = allRawTrips.length - finalTrips.length;

    console.log(
      `${logPrefix}Vessel filtering: ${allRawTrips.length} → ${finalTrips.length} trips (${totalFiltered} filtered out)`
    );

    const totalTripsDownloaded = finalTrips.length;

    console.log(
      `${logPrefix}Successfully downloaded ${totalTripsDownloaded} trips across ${routeData.length} routes`
    );

    // Phase 3: Only now that we have all data, delete existing data
    console.log(`${logPrefix}Deleting all existing trips for ${targetDate}`);
    const deleteResult = await ctx.runMutation(
      api.functions.scheduledTrips.mutations.deleteScheduledTripsForDate,
      { sailingDay: targetDate }
    );
    console.log(
      `${logPrefix}Deleted ${deleteResult.deleted} existing trips for ${targetDate}`
    );

    // Phase 4: Insert all the fresh downloaded data (overlaps already resolved by filtering)
    console.log(`${logPrefix}Inserting fresh data`);
    let totalInserted = 0;

    if (finalTrips.length > 0) {
      const insertResult = await ctx.runMutation(
        api.functions.scheduledTrips.mutations.insertScheduledTrips,
        { trips: finalTrips }
      );
      totalInserted = insertResult.inserted;
      console.log(`${logPrefix}Inserted ${totalInserted} filtered trips`);
    }

    console.log(
      `${logPrefix}Safe sync completed: deleted ${deleteResult.deleted}, inserted ${totalInserted}, filtered ${totalFiltered} trips across ${routeData.length} routes`
    );

    return {
      deleted: deleteResult.deleted,
      inserted: totalInserted,
      routesProcessed: routeData.length,
      totalFiltered,
    };
  } catch (error) {
    console.error(
      `${logPrefix}Safe scheduled trips sync failed for ${targetDate}:`,
      error
    );
    throw new ConvexError({
      message: `Safe scheduled trips sync failed for ${targetDate}`,
      code: "SAFE_SYNC_SCHEDULED_TRIPS_FAILED",
      severity: "error",
      details: { targetDate, error: String(error) },
    });
  }
};

/**
 * Unified sync function that can perform either single date or windowed sync.
 * Handles both manual and automated sync scenarios with configurable behavior.
 *
 * @param ctx - Convex action context
 * @param config - Sync configuration
 * @returns Sync results
 */
export const performUnifiedScheduledTripsSync = async (
  ctx: ActionCtx,
  config: {
    mode: "single" | "window";
    targetDate?: string;
    windowDays?: number;
    logPrefix?: string;
  }
): Promise<{
  totalDeleted: number;
  totalInserted: number;
  totalFiltered: number;
  daysProcessed: DaySyncResult[];
}> => {
  const logPrefix = config.logPrefix || "[UNIFIED] ";

  if (config.mode === "single") {
    if (!config.targetDate) {
      throw new Error("targetDate required for single mode");
    }

    console.log(
      `${logPrefix}Starting single date sync for ${config.targetDate}`
    );
    const result = await syncScheduledTripsForDate(
      ctx,
      config.targetDate,
      logPrefix
    );

    return {
      totalDeleted: result.deleted,
      totalInserted: result.inserted,
      totalFiltered: result.totalFiltered,
      daysProcessed: [
        {
          sailingDay: config.targetDate,
          action: "updated",
        },
      ],
    };
  } else if (config.mode === "window") {
    const windowDays = config.windowDays || 7;
    const today = new Date();

    console.log(
      `${logPrefix}Starting windowed sync for ${windowDays}-day rolling window`
    );

    const syncResults: DaySyncResult[] = [];
    let totalDeleted = 0;
    let totalInserted = 0;
    let totalFiltered = 0;

    // Process each day in the rolling window sequentially
    for (let i = 0; i < windowDays; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const sailingDay = formatPacificDate(targetDate);

      try {
        // Check if we already have data for this day
        const hasData = await hasDataForDay(ctx, sailingDay);

        if (hasData) {
          console.log(`${logPrefix}Data exists for ${sailingDay}, refreshing`);
          const result = await syncScheduledTripsForDate(
            ctx,
            sailingDay,
            logPrefix
          );
          syncResults.push({ sailingDay, action: "updated" });
          totalDeleted += result.deleted;
          totalInserted += result.inserted;
          totalFiltered += result.totalFiltered;
        } else {
          console.log(`${logPrefix}No data for ${sailingDay}, downloading`);
          const result = await syncScheduledTripsForDate(
            ctx,
            sailingDay,
            logPrefix
          );
          syncResults.push({ sailingDay, action: "downloaded" });
          totalDeleted += result.deleted;
          totalInserted += result.inserted;
          totalFiltered += result.totalFiltered;
        }
      } catch (error) {
        console.error(`${logPrefix}Failed to sync ${sailingDay}:`, error);
        syncResults.push({
          sailingDay,
          action: "failed",
          error: String(error),
        });
      }
    }

    const downloaded = syncResults.filter(
      (r) => r.action === "downloaded"
    ).length;
    const updated = syncResults.filter((r) => r.action === "updated").length;
    const failed = syncResults.filter((r) => r.action === "failed").length;

    console.log(
      `${logPrefix}Windowed sync completed: ${downloaded} downloaded, ${updated} updated, ${failed} failed, ${totalFiltered} total filtered`
    );

    return {
      totalDeleted,
      totalInserted,
      totalFiltered,
      daysProcessed: syncResults,
    };
  } else {
    throw new Error(`Invalid sync mode: ${config.mode}`);
  }
};

/**
 * Checks if schedule data already exists for a specific sailing day.
 */
const hasDataForDay = async (
  ctx: ActionCtx,
  sailingDay: string
): Promise<boolean> => {
  const trips = await ctx.runQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForSailingDay,
    { sailingDay }
  );
  return trips.length > 0;
};
