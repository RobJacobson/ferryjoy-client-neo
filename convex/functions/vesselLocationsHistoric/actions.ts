/**
 * Defines scheduled actions for historic vessel-location snapshots and cleanup.
 */

import { internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import { v } from "convex/values";
import { updateVesselLocations } from "domain/vesselOrchestration/updateVesselLocations";
import { loadTerminalIdentities } from "functions/terminals/actions";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexHistoricVesselLocation } from "functions/vesselLocationsHistoric/schemas";
import { loadVesselIdentities } from "functions/vessels/actions";
import { getSailingDay } from "shared/time";

const HISTORIC_RETENTION_SAILING_DAYS = 2;
const DELETE_BATCH_SIZE = 500;

type HistoricSnapshotResult = {
  inserted: number;
};

type HistoricCleanupResult = {
  cutoffSailingDay: string;
  deleted: number;
};

/**
 * Fetches WSF vessel locations and stores a historic debug snapshot.
 *
 * @param ctx - Convex action context
 * @returns Insert summary for the captured snapshot
 */
export const captureHistoricVesselLocations = internalAction({
  args: {},
  returns: v.object({
    inserted: v.number(),
  }),
  handler: async (ctx): Promise<HistoricSnapshotResult> => {
    const vesselIdentities = await loadVesselIdentities(ctx);
    const terminalIdentities = await loadTerminalIdentities(ctx);
    const rawFeedLocations = await fetchRawWsfVesselLocations();
    const { vesselLocations: convexLocations } = updateVesselLocations({
      rawFeedLocations,
      vesselsIdentity: vesselIdentities,
      terminalsIdentity: terminalIdentities,
    });

    const locations: ConvexHistoricVesselLocation[] =
      convexLocations.map(addSailingDay);

    const result: HistoricSnapshotResult = await ctx.runMutation(
      internal.functions.vesselLocationsHistoric.mutations.insertSnapshotBatch,
      {
        locations,
      }
    );

    return result;
  },
});

/**
 * Purges historic vessel-location rows outside the sailing-day retention window.
 *
 * @param ctx - Convex action context
 * @param args.currentSailingDayOverride - Optional sailing day override for testing
 * @returns Summary of the cleanup operation
 */
export const cleanupHistoricVesselLocations = internalAction({
  args: {
    currentSailingDayOverride: v.optional(v.string()),
  },
  returns: v.object({
    cutoffSailingDay: v.string(),
    deleted: v.number(),
  }),
  handler: async (ctx, args): Promise<HistoricCleanupResult> => {
    const currentSailingDay =
      args.currentSailingDayOverride ?? getSailingDay(new Date());
    const cutoffSailingDay = addSailingDays(
      currentSailingDay,
      -(HISTORIC_RETENTION_SAILING_DAYS - 1)
    );

    let totalDeleted = 0;

    while (true) {
      const result = await ctx.runMutation(
        internal.functions.vesselLocationsHistoric.mutations
          .deleteHistoricLocationsBeforeSailingDayBatch,
        {
          cutoffSailingDay,
          limit: DELETE_BATCH_SIZE,
        }
      );

      totalDeleted += result.deleted;

      if (!result.hasMore) {
        break;
      }
    }

    return {
      cutoffSailingDay,
      deleted: totalDeleted,
    };
  },
});

/**
 * Attaches Pacific sailing-day string from a live location epoch timestamp.
 *
 * @param location - Convex vessel location row (numeric `TimeStamp`)
 * @returns Historic snapshot row including `SailingDay`
 */
const addSailingDay = (
  location: ConvexVesselLocation
): ConvexHistoricVesselLocation => ({
  ...location,
  SailingDay: getSailingDay(new Date(location.TimeStamp)),
});

/**
 * Adds whole sailing days to a YYYY-MM-DD sailing-day string.
 *
 * @param dateString - Base sailing day string in Pacific service-day format
 * @param days - Number of sailing days to add
 * @returns Shifted sailing day string
 */
const addSailingDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
