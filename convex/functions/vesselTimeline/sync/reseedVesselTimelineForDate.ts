/**
 * Reseeds vessel timeline DB rows for one sailing day via schedule fetch,
 * domain seed/hydrate, and internal reseed mutation.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchAndTransformScheduledTrips } from "adapters";
import {
  buildSeedVesselTripEventsFromRawSegments,
  hydrateSeededEventsWithHistory,
} from "domain/timelineReseed";
import { loadTerminalIdentities } from "functions/terminalIdentities/actions";
import { loadVesselIdentities } from "functions/vesselIdentities/actions";
import { fetchHistoryRecordsForDate } from "./fetchHistoryRecordsForDate";
import type { TimelineSyncResult } from "./types";

const LOG_PREFIX = "[SYNC VESSEL TIMELINE]";

/**
 * Rebuild scheduled and actual vessel timeline rows for one sailing day.
 *
 * @param ctx - Convex action context
 * @param targetDate - Sailing day in YYYY-MM-DD format
 * @returns Scheduled and actual row counts written for the date
 */
export const reseedVesselTimelineForDate = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<TimelineSyncResult> => {
  // Log the start of the reseed
  console.log(`${LOG_PREFIX} Starting reseed for ${targetDate}`);

  // Load vessels
  const vessels = await loadVesselIdentities(ctx);

  // Load terminals
  const terminals = await loadTerminalIdentities(ctx);

  // Fetch and transform scheduled trips
  const { routeData } = await fetchAndTransformScheduledTrips(
    targetDate,
    vessels,
    terminals
  );
  const scheduleSegments = routeData.flatMap((data) => data.segments);

  // Log the number of schedule segments
  console.log(
    `${LOG_PREFIX} Found ${scheduleSegments.length} schedule segments for ${targetDate}`
  );

  // Build the seeded events
  const seededEvents = buildSeedVesselTripEventsFromRawSegments(
    scheduleSegments,
    vessels,
    terminals
  );

  // Fetch the history records
  const historyRecords = await fetchHistoryRecordsForDate(
    scheduleSegments,
    targetDate
  );

  // Hydrate the seeded events with the history records
  const hydratedEvents = hydrateSeededEventsWithHistory({
    seededEvents,
    existingEvents: [],
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });

  // Run the reseed mutation
  const result = await ctx.runMutation(
    internal.functions.vesselTimeline.mutations
      .reseedBoundaryEventsForSailingDay,
    {
      SailingDay: targetDate,
      Events: hydratedEvents,
    }
  );

  // Log the result
  console.log(
    `${LOG_PREFIX} reseed completed for ${targetDate}: ${result.ScheduledCount} scheduled rows`
  );

  // Return the result
  return result;
};
