/**
 * Reads from eventsPredicted: ETA and ML predictions per dock boundary, for use
 * next to scheduled and actual event rows in trip and timeline assembly.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { predictedDockCompositeKey } from "domain/events/predicted/predictedDockCompositeKey";
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
 * Comparator for client-facing predicted event lists.
 *
 * Sorts by ScheduledDeparture then Key so multiple prediction types on the same
 * boundary stay in a stable, human-predictable order.
 *
 * @param left - First row after metadata strip
 * @param right - Second row after metadata strip
 * @returns Numeric comparison result for array sort
 */
const sortPredictedDockEventsForPublicList = (
  left: ConvexPredictedDockEvent,
  right: ConvexPredictedDockEvent
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  left.Key.localeCompare(right.Key);

/**
 * Reads predicted rows for one vessel and sailing day from storage.
 *
 * Index-scoped collection keeps reads small; stripConvexMeta removes Convex fields
 * before returning validator-shaped objects to callers and list subscriptions.
 *
 * @param ctx - Convex query context exposing db
 * @param args.vesselAbbrev - VesselAbbrev column value
 * @param args.sailingDay - Calendar sailing day YYYY-MM-DD
 * @returns Predicted rows sorted for presentation
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
 * Public Convex query listing predicted dock events for vessel scope.
 *
 * Validates inputs and array returns at the Convex boundary; delegates to the reader
 * so tests and internal modules can share the same ordering logic.
 *
 * @param ctx - Convex query context
 * @param args.vesselAbbrev - VesselAbbrev column value
 * @param args.sailingDay - Calendar sailing day YYYY-MM-DD
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
 * Loads predictions grouped by vessel-day scope and composite prediction key.
 *
 * Builds unique scopes from trip inputs, loads each sailing day once per vessel,
 * then indexes rows by predictedDockCompositeKey so trip joins resolve predictions
 * without scanning unrelated days or duplicating network payloads.
 *
 * @param ctx - Convex query context exposing db
 * @param trips - Trip-like rows carrying VesselAbbrev and optional SailingDay
 * @returns Nested map from scope key to composite-key map of predicted rows
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
