/**
 * Internal mutations for the normalized VesselTimeline boundary-event tables.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import {
  applyLiveLocationToEvents,
  getLocationSailingDay,
  normalizeScheduledDockSeams,
  sortVesselTripEvents,
} from "domain/vesselTimeline/events";
import {
  buildActualBoundaryEvents,
  buildPredictedBoundaryEventsFromTrips,
  buildScheduledBoundaryEvents,
} from "domain/vesselTimeline/normalizedEvents";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import { vesselTimelineEventRecordSchema } from "./eventRecordSchemas";
import { vesselTripSchema } from "../vesselTrips/schemas";

export const replaceBoundaryEventsForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(vesselTimelineEventRecordSchema),
  },
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const events = normalizeScheduledDockSeams(args.Events).sort(sortVesselTripEvents);

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
      ScheduledCount: events.length,
      ActualCount: events.filter((event) => event.ActualTime !== undefined).length,
    };
  },
});

export const applyLiveActualUpdates = internalMutation({
  args: {
    Locations: v.array(vesselLocationValidationSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const location of args.Locations) {
      await applyLiveActualUpdateForLocation(ctx, location);
    }

    return null;
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
      for (const row of buildPredictedBoundaryEventsFromTrips([trip])) {
        targetKeys.add(row.Key);
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

const applyLiveActualUpdateForLocation = async (
  ctx: MutationCtx,
  location: ConvexVesselLocation
) => {
  const SailingDay = getLocationSailingDay(location);
  const [scheduledDocs, actualDocs] = await Promise.all([
    ctx.db
      .query("eventsScheduled")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q.eq("VesselAbbrev", location.VesselAbbrev).eq("SailingDay", SailingDay)
      )
      .collect(),
    ctx.db
      .query("eventsActual")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q.eq("VesselAbbrev", location.VesselAbbrev).eq("SailingDay", SailingDay)
      )
      .collect(),
  ]);

  if (scheduledDocs.length === 0) {
    return;
  }

  const actualByKey = new Map<
    string,
    Doc<"eventsActual">
  >(actualDocs.map((doc) => [doc.Key, doc]));
  const mergedEvents = normalizeScheduledDockSeams(
    scheduledDocs
      .map((doc) => ({
        Key: doc.Key,
        VesselAbbrev: doc.VesselAbbrev,
        SailingDay: doc.SailingDay,
        ScheduledDeparture: doc.ScheduledDeparture,
        TerminalAbbrev: doc.TerminalAbbrev,
        EventType: doc.EventType,
        ScheduledTime: doc.ScheduledTime,
        PredictedTime: undefined,
        ActualTime: actualByKey.get(doc.Key)?.ActualTime,
      }))
      .sort(sortVesselTripEvents)
  );

  const updatedEvents = applyLiveLocationToEvents(mergedEvents, location);
  const updatedActualRows = buildActualBoundaryEvents(updatedEvents, Date.now()).filter(
    (row) =>
      row.VesselAbbrev === location.VesselAbbrev && row.SailingDay === SailingDay
  );

  await replaceActualRowsForVesselDay(
    ctx,
    location.VesselAbbrev,
    SailingDay,
    updatedActualRows
  );
};

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
