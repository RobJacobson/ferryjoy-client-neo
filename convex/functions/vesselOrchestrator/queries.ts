/**
 * Internal read models for the vessel orchestrator action.
 *
 * Bundles DB snapshots that the orchestrator needs each ping so one query
 * replaces separate vessel, terminal, and active-trip round trips from actions.
 * Active trips are **storage-native** (no `eventsPredicted` join); public
 * queries load predicted rows via `eventsPredicted` queries and merge with
 * `mergeTripsWithPredictions` for API parity instead.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { loadScheduledDockEventsForVesselSailingDay } from "functions/events/eventsScheduled/queries";
import { eventsScheduledSchema } from "functions/events/eventsScheduled/schemas";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { vesselIdentitySchema } from "functions/vessels/schemas";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { getSailingDay } from "shared/time";

/** Return validator for {@link getOrchestratorModelData}. */
const orchestratorModelDataSchema = v.object({
  vesselsIdentity: v.array(vesselIdentitySchema),
  terminalsIdentity: v.array(terminalIdentitySchema),
  activeTrips: v.array(vesselTripStoredSchema),
});

/**
 * Load vessels, terminals, and active trips in one transaction for one ping.
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

/** Return validator for {@link getScheduleSnapshotForPing}. */
const scheduleSnapshotReturnSchema = v.object({
  eventsByVesselAbbrev: v.record(v.string(), v.array(eventsScheduledSchema)),
});

/**
 * Bulk `eventsScheduled` read for one vessel orchestrator ping.
 *
 * Loads one sailing day (derived from `pingStartedAt`) for all vessels and
 * returns rows grouped by vessel abbreviation. Downstream lookup adapters
 * derive both same-day reads and departure-by-segment lookups from this map.
 */
export const getScheduleSnapshotForPing = internalQuery({
  args: {
    pingStartedAt: v.number(),
  },
  returns: scheduleSnapshotReturnSchema,
  handler: async (ctx, args) => {
    const vesselAbbrevs = [
      ...new Set(
        (await ctx.db.query("vesselsIdentity").collect()).map(
          (vessel) => vessel.VesselAbbrev
        )
      ),
    ];
    const sailingDay = getSailingDay(new Date(args.pingStartedAt));
    const eventsByVesselEntries = await Promise.all(
      vesselAbbrevs.map(async (vesselAbbrev) => [
        vesselAbbrev,
        await loadScheduledDockEventsForVesselSailingDay(ctx, {
          vesselAbbrev,
          sailingDay,
        }),
      ])
    );
    const eventsByVesselAbbrev = Object.fromEntries(eventsByVesselEntries);

    return {
      eventsByVesselAbbrev,
    };
  },
});
