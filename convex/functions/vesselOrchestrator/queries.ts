/**
 * Internal read models for the vessel orchestrator action.
 *
 * Bundles DB snapshots that the orchestrator needs each tick so one query
 * replaces separate vessel, terminal, and active-trip round trips from actions.
 * Active trips are **storage-native** (no `eventsPredicted` join); public
 * queries load predicted rows via `eventsPredicted` queries and merge with
 * `mergeTripsWithPredictions` for API parity instead.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import {
  MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS,
  scheduleSnapshotCompositeKey,
} from "domain/vesselOrchestration/shared";
import { loadScheduledDockEventsForVesselSailingDay } from "functions/events/eventsScheduled/queries";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import { eventsScheduledSchema } from "functions/events/eventsScheduled/schemas";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { vesselIdentitySchema } from "functions/vessels/schemas";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";
import { buildBoundaryKey } from "shared/keys";
import { stripConvexMeta } from "shared/stripConvexMeta";

/** Return validator for {@link getOrchestratorModelData}. */
const orchestratorModelDataSchema = v.object({
  vesselsIdentity: v.array(vesselIdentitySchema),
  terminalsIdentity: v.array(terminalIdentitySchema),
  activeTrips: v.array(vesselTripStoredSchema),
});

/**
 * Load vessels, terminals, and active trips in one transaction for one tick.
 *
 * Matches vessel/terminal shapes used elsewhere; active trips match persisted
 * `activeVesselTrips` rows (not `getActiveTrips`, which enriches them with
 * predictions for subscribers).
 *
 * @param ctx - Convex query context
 * @returns Stripped vessel rows, terminal rows, and storage-native active trips
 */
export const getOrchestratorModelData = internalQuery({
  args: {},
  returns: orchestratorModelDataSchema,
  handler: async (ctx) => {
    // Run three queries for vessel identities, terminal identities, and active trips
    const [vessels, terminals, trips] = await Promise.all([
      ctx.db.query("vesselsIdentity").collect(),
      ctx.db.query("terminalsIdentity").collect(),
      ctx.db.query("activeVesselTrips").collect(),
    ]);

    // Return the results as an object with the correct shapes
    return {
      vesselsIdentity: vessels.map(stripConvexMeta),
      terminalsIdentity: terminals.map(stripConvexMeta),
      activeTrips: trips.map(stripConvexMeta),
    };
  },
});

/** Return validator for {@link getScheduleSnapshotForTick}. */
const scheduleSnapshotReturnSchema = v.object({
  departuresBySegmentKey: v.record(v.string(), eventsScheduledSchema),
  sameDayEventsByCompositeKey: v.record(
    v.string(),
    v.array(eventsScheduledSchema)
  ),
});

/**
 * Bulk `eventsScheduled` read for one vessel orchestrator tick.
 *
 * **Plan B (rollback):** If this query’s payload or internal read cost is too high
 * in production, swap the action back to a narrow adapter that performs only the
 * two underlying reads per logical need: departure by `by_key` (`buildBoundaryKey`
 * + `dep-dock`) and same-day bundle by `by_vessel_and_sailing_day`—without pulling
 * the full cartesian snapshot—while keeping `ScheduledSegmentLookup` as the
 * domain contract.
 *
 * **Cost note:** This is **one** `runQuery` from the action, but the handler issues
 * **N `ctx.db` reads**: one indexed collect per unique `(vesselAbbrev, sailingDay)`
 * pair plus one `by_key` lookup per unique segment key. Tune caps in
 * `scheduleSnapshotLimits` if Convex query limits are approached.
 */
export const getScheduleSnapshotForTick = internalQuery({
  args: {
    sailingDays: v.array(v.string()),
    segmentKeys: v.array(v.string()),
  },
  returns: scheduleSnapshotReturnSchema,
  handler: async (ctx, args) => {
    if (args.sailingDays.length > MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS) {
      throw new Error(
        `getScheduleSnapshotForTick: sailingDays length exceeds ${MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS}`
      );
    }
    const vesselAbbrevs = [
      ...new Set(
        (await ctx.db.query("vesselsIdentity").collect()).map(
          (vessel) => vessel.VesselAbbrev
        )
      ),
    ];
    const sailingDays = [...new Set(args.sailingDays)];
    const segmentKeys = [...new Set(args.segmentKeys)];

    const pairEntries = vesselAbbrevs.flatMap((vesselAbbrev) =>
      sailingDays.map((sailingDay) => {
        const composite = scheduleSnapshotCompositeKey(
          vesselAbbrev,
          sailingDay
        );
        return [composite, { vesselAbbrev, sailingDay }] as const;
      })
    );
    const pairs = [...new Map(pairEntries).values()];

    const sameDayEntries = await Promise.all(
      pairs.map(async (pair) => {
        const key = scheduleSnapshotCompositeKey(
          pair.vesselAbbrev,
          pair.sailingDay
        );
        const events = await loadScheduledDockEventsForVesselSailingDay(
          ctx,
          pair
        );
        return [key, events] as const;
      })
    );
    const sameDayEventsByCompositeKey = Object.fromEntries(sameDayEntries);

    const departurePairs = await Promise.all(
      segmentKeys.map(async (segmentKey) => {
        const row = await ctx.db
          .query("eventsScheduled")
          .withIndex("by_key", (q) =>
            q.eq("Key", buildBoundaryKey(segmentKey, "dep-dock"))
          )
          .unique();
        return [segmentKey, row] as const;
      })
    );
    const departuresBySegmentKey = Object.fromEntries(
      departurePairs.flatMap(([segmentKey, row]) =>
        row === null ? [] : [[segmentKey, row]]
      )
    ) as Record<string, ConvexScheduledDockEvent>;

    return {
      departuresBySegmentKey,
      sameDayEventsByCompositeKey,
    };
  },
});
