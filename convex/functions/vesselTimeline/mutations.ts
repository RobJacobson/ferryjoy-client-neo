/**
 * Internal mutations for the normalized VesselTimeline boundary-event tables.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import {
  buildActualBoundaryEvents,
  buildPredictedBoundaryEventsFromTrips,
  buildScheduledBoundaryEvents,
} from "domain/vesselTimeline/normalizedEvents";
import { buildEventKey } from "domain/vesselTimeline/events";
import { getSailingDay } from "shared/time";
import { type ConvexVesselTripEvent, vesselTripEventSchema } from "../vesselTripEvents/schemas";
import { type ConvexVesselTrip, vesselTripSchema } from "../vesselTrips/schemas";

/**
 * Replaces the normalized scheduled boundary rows for one sailing day from the
 * current legacy event feed.
 *
 * Schedule/backfill flows own `eventsScheduled`. Live updates must not call
 * this mutation.
 */
export const syncScheduledEventsForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(vesselTripEventSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scheduledRows = buildScheduledBoundaryEvents(args.Events, Date.now());

    await replaceScheduledRowsForSailingDay(ctx, args.SailingDay, scheduledRows);
    return null;
  },
});

/**
 * Replaces normalized actual-time overlays for one sailing day from the
 * current legacy event feed.
 */
export const syncActualEventsForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(vesselTripEventSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actualRows = buildActualBoundaryEvents(args.Events, Date.now());

    await replaceActualRowsForSailingDay(ctx, args.SailingDay, actualRows);
    return null;
  },
});

/**
 * Syncs only actual-time overlays for one vessel/day from the current legacy
 * event mirror.
 */
export const syncActualEventsForVesselDay = internalMutation({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
    Events: v.array(vesselTripEventSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actualRows = buildActualBoundaryEvents(args.Events, Date.now()).filter(
      (row) =>
        row.VesselAbbrev === args.VesselAbbrev && row.SailingDay === args.SailingDay
    );

    await replaceActualRowsForVesselDay(
      ctx,
      args.VesselAbbrev,
      args.SailingDay,
      actualRows
    );

    return null;
  },
});

/**
 * Backfills normalized scheduled and actual boundary rows directly from the
 * current legacy vesselTripEvents mirror for one sailing day.
 */
export const backfillNormalizedEventsFromLegacyForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
  },
  returns: v.object({
    eventCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("vesselTripEvents")
      .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.SailingDay))
      .collect();
    const events = docs.map((doc) => ({
      Key: doc.Key,
      VesselAbbrev: doc.VesselAbbrev,
      SailingDay: doc.SailingDay,
      ScheduledDeparture: doc.ScheduledDeparture,
      TerminalAbbrev: doc.TerminalAbbrev,
      EventType: doc.EventType,
      ScheduledTime: doc.ScheduledTime,
      PredictedTime: doc.PredictedTime,
      ActualTime: doc.ActualTime,
    }));

    const updatedAt = Date.now();
    await replaceScheduledRowsForSailingDay(
      ctx,
      args.SailingDay,
      buildScheduledBoundaryEvents(events, updatedAt)
    );
    await replaceActualRowsForSailingDay(
      ctx,
      args.SailingDay,
      buildActualBoundaryEvents(events, updatedAt)
    );

    return {
      eventCount: events.length,
    };
  },
});

/**
 * Syncs best-prediction overlays from finalized active trip state.
 */
export const syncPredictedEventsForTrips = internalMutation({
  args: {
    Trips: v.array(vesselTripSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nextRowsByKey = new Map(
      buildPredictedBoundaryEventsFromTrips(args.Trips).map((row) => [
        row.Key,
        row,
      ])
    );

    const targetKeys = new Set<string>();
    for (const trip of args.Trips) {
      for (const key of getPredictionTargetKeys(trip)) {
        targetKeys.add(key);
      }
    }

    for (const Key of targetKeys) {
      const existing = await ctx.db
        .query("eventsPredicted")
        .withIndex("by_key", (q) => q.eq("Key", Key))
        .unique();
      const nextRow = nextRowsByKey.get(Key);

      if (!nextRow) {
        if (existing) {
          await ctx.db.delete(existing._id);
        }
        continue;
      }

      if (!existing) {
        await ctx.db.insert("eventsPredicted", nextRow);
        continue;
      }

      if (predictedRowsEqual(existing, nextRow)) {
        continue;
      }

      await ctx.db.replace(existing._id, nextRow);
    }

    return null;
  },
});

const replaceScheduledRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ReturnType<typeof buildScheduledBoundaryEvents>
) => {
  const existingRows = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();
  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));
  const nextKeys = new Set(nextRows.map((row) => row.Key));

  for (const existing of existingRows) {
    if (!nextKeys.has(existing.Key)) {
      await ctx.db.delete(existing._id);
    }
  }

  for (const nextRow of nextRows) {
    const existing = existingByKey.get(nextRow.Key);

    if (!existing) {
      await ctx.db.insert("eventsScheduled", nextRow);
      continue;
    }

    if (scheduledRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

const replaceActualRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ReturnType<typeof buildActualBoundaryEvents>
) => {
  const existingRows = await ctx.db
    .query("eventsActual")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();
  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));
  const nextKeys = new Set(nextRows.map((row) => row.Key));

  for (const existing of existingRows) {
    if (!nextKeys.has(existing.Key)) {
      await ctx.db.delete(existing._id);
    }
  }

  for (const nextRow of nextRows) {
    const existing = existingByKey.get(nextRow.Key);

    if (!existing) {
      await ctx.db.insert("eventsActual", nextRow);
      continue;
    }

    if (actualRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

const replaceActualRowsForVesselDay = async (
  ctx: MutationCtx,
  VesselAbbrev: string,
  SailingDay: string,
  nextRows: ReturnType<typeof buildActualBoundaryEvents>
) => {
  const existingRows = await ctx.db
    .query("eventsActual")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", VesselAbbrev).eq("SailingDay", SailingDay)
    )
    .collect();
  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));
  const nextKeys = new Set(nextRows.map((row) => row.Key));

  for (const existing of existingRows) {
    if (!nextKeys.has(existing.Key)) {
      await ctx.db.delete(existing._id);
    }
  }

  for (const nextRow of nextRows) {
    const existing = existingByKey.get(nextRow.Key);

    if (!existing) {
      await ctx.db.insert("eventsActual", nextRow);
      continue;
    }

    if (actualRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

const scheduledRowsEqual = (
  left: Doc<"eventsScheduled">,
  right: ReturnType<typeof buildScheduledBoundaryEvents>[number]
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.NextTerminalAbbrev === right.NextTerminalAbbrev &&
  left.EventType === right.EventType &&
  left.ScheduledTime === right.ScheduledTime;

const actualRowsEqual = (
  left: Doc<"eventsActual">,
  right: ReturnType<typeof buildActualBoundaryEvents>[number]
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.ActualTime === right.ActualTime;

const predictedRowsEqual = (
  left: Doc<"eventsPredicted">,
  right: ReturnType<typeof buildPredictedBoundaryEventsFromTrips>[number]
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.PredictedTime === right.PredictedTime &&
  left.PredictionType === right.PredictionType &&
  left.PredictionSource === right.PredictionSource;

const getPredictionTargetKeys = (trip: ConvexVesselTrip) => {
  const keys: string[] = [];

  if (trip.ScheduledDeparture !== undefined && trip.DepartingTerminalAbbrev) {
    const SailingDay = getSailingDay(new Date(trip.ScheduledDeparture));
    keys.push(
      buildEventKey(
        SailingDay,
        trip.VesselAbbrev,
        trip.ScheduledDeparture,
        trip.DepartingTerminalAbbrev,
        "dep-dock"
      )
    );
    keys.push(
      buildEventKey(
        SailingDay,
        trip.VesselAbbrev,
        trip.ScheduledDeparture,
        trip.DepartingTerminalAbbrev,
        "arv-dock"
      )
    );
  }

  if (
    trip.NextScheduledDeparture !== undefined &&
    trip.ArrivingTerminalAbbrev
  ) {
    const SailingDay = getSailingDay(new Date(trip.NextScheduledDeparture));
    keys.push(
      buildEventKey(
        SailingDay,
        trip.VesselAbbrev,
        trip.NextScheduledDeparture,
        trip.ArrivingTerminalAbbrev,
        "dep-dock"
      )
    );
  }

  return keys;
};
