/**
 * Internal persistence queries for normalized predicted dock events.
 */

import type { Doc } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { predictedDockCompositeKey } from "domain/events/predicted/schemas";
import {
  buildVesselSailingDayScopeKey,
  parseVesselSailingDayScopeKey,
} from "shared/keys";

/**
 * Loads all predicted dock events for one vessel and sailing day.
 *
 * Returns raw docs (metadata retained) for callers that need `_id` or join logic;
 * strip at the API boundary when returning client shapes.
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
 * Batch-loads predicted rows for the vessel/sailing-day scopes implied by trips.
 *
 * Builds scope keys from `SailingDay`, loads each day once, then indexes rows by
 * `predictedDockCompositeKey` for efficient joins in trip read paths.
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
