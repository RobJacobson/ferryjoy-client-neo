import type { Doc } from "_generated/dataModel";
import { internalMutation } from "_generated/server";
import type { MutationCtx } from "_generated/server";
import { v } from "convex/values";
import {
  applyLiveLocationToEvents,
  getLocationSailingDay,
  sortVesselTripEvents,
} from "domain/vesselTripEvents";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import { type ConvexVesselTripEvent, vesselTripEventSchema } from "./schemas";

export const replaceForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(vesselTripEventSchema),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vesselTripEvents")
      .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.SailingDay))
      .collect();

    for (const event of existing) {
      await ctx.db.delete(event._id);
    }

    for (const event of args.Events) {
      await ctx.db.insert("vesselTripEvents", event);
    }

    return {
      Deleted: existing.length,
      Inserted: args.Events.length,
    };
  },
});

export const applyLiveUpdates = internalMutation({
  args: {
    Locations: v.array(vesselLocationValidationSchema),
  },
  handler: async (ctx, args) => {
    for (const location of args.Locations) {
      const SailingDay = getLocationSailingDay(location);
      const docs = await ctx.db
        .query("vesselTripEvents")
        .withIndex("by_vessel_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", location.VesselAbbrev)
            .eq("SailingDay", SailingDay)
        )
        .collect();

      if (docs.length === 0) {
        continue;
      }

      const updatedEvents = applyLiveLocationToEvents(
        docs.map(stripDocMeta).sort(sortVesselTripEvents),
        location
      );

      await persistEventChanges(ctx, docs, updatedEvents);
    }
  },
});

const persistEventChanges = async (
  ctx: MutationCtx,
  docs: Doc<"vesselTripEvents">[],
  updatedEvents: ConvexVesselTripEvent[]
) => {
  const existingById = new Map(
    docs.map((doc) => [doc.EventId, { _id: doc._id, event: stripDocMeta(doc) }])
  );

  for (const event of updatedEvents) {
    const existing = existingById.get(event.EventId);
    if (!existing || eventsEqual(existing.event, event)) {
      continue;
    }

    await ctx.db.replace(existing._id, event);
  }
};

const eventsEqual = (
  left: ConvexVesselTripEvent,
  right: ConvexVesselTripEvent
) =>
  left.EventId === right.EventId &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.EventType === right.EventType &&
  left.ScheduledTime === right.ScheduledTime &&
  left.PredictedTime === right.PredictedTime &&
  left.ActualTime === right.ActualTime;

const stripDocMeta = (doc: Doc<"vesselTripEvents">): ConvexVesselTripEvent => ({
  EventId: doc.EventId,
  VesselAbbrev: doc.VesselAbbrev,
  SailingDay: doc.SailingDay,
  ScheduledDeparture: doc.ScheduledDeparture,
  TerminalAbbrev: doc.TerminalAbbrev,
  EventType: doc.EventType,
  ScheduledTime: doc.ScheduledTime,
  PredictedTime: doc.PredictedTime,
  ActualTime: doc.ActualTime,
});
