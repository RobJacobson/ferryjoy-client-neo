/**
 * Reads from `eventsPredicted`: ETA / ML predictions per dock boundary, joined
 * to trips and events alongside scheduled and actual rows.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { predictedDockCompositeKey } from "domain/events/predicted/schemas";
import {
  buildVesselSailingDayScopeKey,
  parseVesselSailingDayScopeKey,
} from "shared/keys";
import { stripConvexMeta } from "shared/stripConvexMeta";
import {
  type ConvexPredictedDockEvent,
  eventsPredictedSchema,
} from "./schemas";

/**
 * Compares two predicted dock events for stable public list ordering.
 *
 * @param left - First row (after metadata strip)
 * @param right - Second row (after metadata strip)
 * @returns Sort comparison for ascending `ScheduledDeparture`, then `Key`
 */
const sortPredictedDockEventsForPublicList = (
  left: ConvexPredictedDockEvent,
  right: ConvexPredictedDockEvent
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  left.Key.localeCompare(right.Key);

/**
 * Reads predicted dock rows for one vessel and sailing day: index collect,
 * strips metadata, then sorts by ascending `ScheduledDeparture`, then `Key`.
 *
 * @param ctx - Convex query context (database handle)
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Validator-shaped predicted rows in deterministic order
 */
const readPredictedDockEventsForVesselSailingDay = async (
  ctx: Pick<QueryCtx, "db">,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexPredictedDockEvent[]> => {
  const docs = await ctx.db
    .query("eventsPredicted")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", args.sailingDay)
    )
    .collect();
  return docs.map(stripConvexMeta).sort(sortPredictedDockEventsForPublicList);
};

/**
 * Lists predicted dock events for one vessel and sailing day for clients.
 *
 * @param ctx - Convex query context
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Validator-shaped predicted rows in deterministic order
 */
const listPredictedDockEventsForVesselSailingDay = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsPredictedSchema),
  handler: async (ctx, args) =>
    readPredictedDockEventsForVesselSailingDay(ctx, args),
});

/**
 * Returns predicted dock rows grouped by vessel-day scope and composite key.
 *
 * Derives one scope per distinct `VesselAbbrev` + `SailingDay` on `trips`,
 * loads each day once, then maps rows by `predictedDockCompositeKey` so trip
 * reads join predictions without scanning other sailing days.
 *
 * @param ctx - Convex query context (database handle)
 * @param trips - Active or completed trip docs (need `VesselAbbrev`, optional `SailingDay`)
 * @returns Stripped predicted rows keyed by scope string then composite key
 */
const loadPredictedRowsGroupedForTrips = async (
  ctx: Pick<QueryCtx, "db">,
  trips: { VesselAbbrev: string; SailingDay?: string }[]
): Promise<Map<string, Map<string, ConvexPredictedDockEvent>>> => {
  const scopeKeys = new Set<string>();
  for (const trip of trips) {
    if (trip.SailingDay) {
      scopeKeys.add(
        buildVesselSailingDayScopeKey(trip.VesselAbbrev, trip.SailingDay)
      );
    }
  }

  const predictedByGroup = new Map<
    string,
    Map<string, ConvexPredictedDockEvent>
  >();

  for (const g of scopeKeys) {
    const { vesselAbbrev, sailingDay } = parseVesselSailingDayScopeKey(g);
    const rows = await readPredictedDockEventsForVesselSailingDay(ctx, {
      vesselAbbrev,
      sailingDay,
    });
    const map = new Map<string, ConvexPredictedDockEvent>();
    for (const row of rows) {
      map.set(predictedDockCompositeKey(row), row);
    }
    predictedByGroup.set(g, map);
  }

  return predictedByGroup;
};

export {
  listPredictedDockEventsForVesselSailingDay,
  loadPredictedRowsGroupedForTrips,
  readPredictedDockEventsForVesselSailingDay,
  sortPredictedDockEventsForPublicList,
};
