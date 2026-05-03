/**
 * Reads from `eventsPredicted`: ETA / ML predictions per dock boundary, joined
 * to trips and timelines alongside scheduled and actual rows.
 */

import type { Doc } from "_generated/dataModel";
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
 * Returns all `eventsPredicted` documents for one `VesselAbbrev` and sailing day.
 *
 * Includes Convex metadata so server-side merges can replace by `_id`.
 * Strip those fields before sending shapes to a client if you need
 * validator-only objects.
 *
 * @param ctx - Convex query context (database handle)
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Full `eventsPredicted` documents (includes Convex metadata)
 */
const loadPredictedDockEventsForVesselSailingDay = async (
  ctx: Pick<QueryCtx, "db">,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<Doc<"eventsPredicted">[]> =>
  ctx.db
    .query("eventsPredicted")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", args.sailingDay)
    )
    .collect();

/**
 * Lists predicted dock events for one vessel and sailing day for clients.
 *
 * Reads via `by_vessel_and_sailing_day`, strips `_id` and `_creationTime`,
 * then sorts by ascending `ScheduledDeparture`, then ascending `Key`
 * (lexicographic).
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
  handler: async (ctx, args) => {
    const docs = await loadPredictedDockEventsForVesselSailingDay(ctx, args);
    return docs.map(stripConvexMeta).sort(sortPredictedDockEventsForPublicList);
  },
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
 */
const loadPredictedRowsGroupedForTrips = async (
  ctx: Pick<QueryCtx, "db">,
  trips: { VesselAbbrev: string; SailingDay?: string }[]
): Promise<Map<string, Map<string, Doc<"eventsPredicted">>>> => {
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
    Map<string, Doc<"eventsPredicted">>
  >();

  for (const g of scopeKeys) {
    const { vesselAbbrev, sailingDay } = parseVesselSailingDayScopeKey(g);
    const rows = await loadPredictedDockEventsForVesselSailingDay(ctx, {
      vesselAbbrev,
      sailingDay,
    });
    const map = new Map<string, Doc<"eventsPredicted">>();
    for (const row of rows) {
      map.set(predictedDockCompositeKey(row), row);
    }
    predictedByGroup.set(g, map);
  }

  return predictedByGroup;
};

export {
  listPredictedDockEventsForVesselSailingDay,
  loadPredictedDockEventsForVesselSailingDay,
  loadPredictedRowsGroupedForTrips,
  sortPredictedDockEventsForPublicList,
};
