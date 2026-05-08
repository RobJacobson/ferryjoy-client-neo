/**
 * Convex queries for eventsPredicted.
 *
 * Predicted dock rows feed timeline subscriptions and vessel-trip prediction
 * joins. Reads stay scoped to vessel/day indexes and group rows by the shared
 * composite prediction identity when enriching trips.
 */

import type { Doc } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { predictedDockCompositeKey } from "domain/events/predicted";
import {
  buildVesselSailingDayScopeKey,
  parseVesselSailingDayScopeKey,
} from "shared/keys";
import { stripConvexMeta } from "shared/stripConvexMeta";
import {
  type ConvexPredictedDockEvent,
  eventsPredictedSchema,
} from "./schemas";

type PredictedQueryArgs = {
  vesselAbbrev: string;
  sailingDay: string;
};

/**
 * Public query listing predicted dock events for a vessel/day scope.
 *
 * @param ctx - Convex query context
 * @param args - Vessel and sailing-day filters
 * @returns Predicted dock rows sorted by scheduled departure then key
 */
const listPredictedDockEventsForVesselSailingDay = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsPredictedSchema),
  handler: async (ctx, args) => {
    const rows = await readPredictedDockEventsForVesselSailingDay(ctx, args);
    return rows
      .map(stripConvexMeta)
      .sort(
        (left, right) =>
          left.ScheduledDeparture - right.ScheduledDeparture ||
          left.Key.localeCompare(right.Key)
      );
  },
});

/**
 * Loads predictions grouped by vessel/day scope and composite prediction key.
 *
 * Trips without SailingDay cannot be scoped to the predicted table and are
 * skipped. Duplicate vessel/day scopes are collected once to avoid repeated
 * indexed reads for active and completed trip batches.
 *
 * @param ctx - Convex read context exposing database access
 * @param trips - Trip-like rows carrying VesselAbbrev and optional SailingDay
 * @returns Nested map keyed by vessel/day scope, then prediction composite key
 */
const loadPredictedRowsGroupedForTrips = async (
  ctx: Pick<QueryCtx, "db">,
  trips: { VesselAbbrev: string; SailingDay?: string }[]
): Promise<Map<string, Map<string, ConvexPredictedDockEvent>>> => {
  const scopeKeys = new Set<string>();

  for (const trip of trips) {
    if (trip.SailingDay === undefined) {
      continue;
    }

    scopeKeys.add(
      buildVesselSailingDayScopeKey(trip.VesselAbbrev, trip.SailingDay)
    );
  }

  const predictedByGroup = new Map<
    string,
    Map<string, ConvexPredictedDockEvent>
  >();

  for (const scopeKey of scopeKeys) {
    const { vesselAbbrev, sailingDay } =
      parseVesselSailingDayScopeKey(scopeKey);
    const rows = await readPredictedDockEventsForVesselSailingDay(ctx, {
      vesselAbbrev,
      sailingDay,
    });
    const rowsByCompositeKey = new Map<string, ConvexPredictedDockEvent>();

    for (const row of rows) {
      rowsByCompositeKey.set(predictedDockCompositeKey(row), row);
    }

    predictedByGroup.set(scopeKey, rowsByCompositeKey);
  }

  return predictedByGroup;
};

/**
 * Loads predicted dock rows for one vessel and sailing day.
 *
 * @param ctx - Convex read context exposing database access
 * @param args - Vessel and sailing-day filters
 * @returns Stored predicted rows for the vessel/day scope
 */
const readPredictedDockEventsForVesselSailingDay = async (
  ctx: Pick<QueryCtx, "db">,
  args: PredictedQueryArgs
): Promise<Doc<"eventsPredicted">[]> =>
  ctx.db
    .query("eventsPredicted")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", args.sailingDay)
    )
    .collect();

export {
  listPredictedDockEventsForVesselSailingDay,
  loadPredictedRowsGroupedForTrips,
};
