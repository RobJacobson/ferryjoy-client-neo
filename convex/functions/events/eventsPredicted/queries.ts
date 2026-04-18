/**
 * Internal persistence queries for normalized predicted dock events.
 */

import type { Doc } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import {
  buildVesselSailingDayScopeKey,
  parseVesselSailingDayScopeKey,
} from "shared/keys";
import { predictedDockCompositeKey } from "./identity";

/**
 * Loads all predicted dock events for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param args.vesselAbbrev - Vessel abbreviation
 * @param args.sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Same-day predicted rows for that vessel
 */
export const loadPredictedDockEventsForVesselSailingDay = async (
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
 * Batch-loads `eventsPredicted` rows for the vessel/sailing-day scopes present
 * on the given trips, keyed by composite prediction id within each scope.
 *
 * @param ctx - Convex query context
 * @param trips - Stored trip documents (active or completed)
 * @returns Map from sailing-day scope key to composite-key → row map
 */
export const loadPredictedRowsGroupedForTrips = async (
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
