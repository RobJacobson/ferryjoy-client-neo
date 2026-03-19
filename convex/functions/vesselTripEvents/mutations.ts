/**
 * Defines internal mutations that maintain the backend-owned
 * `vesselTripEvents` read model for vessel timeline rendering.
 */
import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import {
  applyLiveLocationToEvents,
  getLocationSailingDay,
  mergeSeededVesselTripEvents,
  sortVesselTripEvents,
} from "domain/vesselTripEvents";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import { type ConvexVesselTripEvent, vesselTripEventSchema } from "./schemas";

/**
 * Merges a fresh schedule seed into the stored read model for one sailing day
 * while preserving present and historical rows owned by live/history data.
 */
export const reseedForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(vesselTripEventSchema),
  },
  returns: v.object({
    Deleted: v.number(),
    Inserted: v.number(),
  }),
  handler: async (ctx, args) => {
    // Guard against seed payloads leaking events from adjacent service days.
    validateSailingDayEvents(args.SailingDay, args.Events);
    const existing = await ctx.db
      .query("vesselTripEvents")
      .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.SailingDay))
      .collect();
    const existingEvents = toEventRecords(existing);
    const mergedEvents = mergeSeededVesselTripEvents({
      existingEvents,
      seededEvents: args.Events,
      nowTimestamp: Date.now(),
    });
    const mergedById = indexEventsById(mergedEvents);
    const existingById = indexEventDocs(existing);
    let deletedCount = 0;

    for (const doc of existing) {
      // Keep the current document when the merged result still points at this
      // exact row so we avoid delete-and-reinsert churn.
      if (
        mergedById.has(doc.Key) &&
        existingById.get(doc.Key)?._id === doc._id
      ) {
        continue;
      }

      await ctx.db.delete(doc._id);
      deletedCount += 1;
    }

    const insertedCount = await persistEventUpserts(
      ctx,
      existingById,
      mergedEvents
    );

    return {
      Deleted: deletedCount,
      Inserted: insertedCount,
    };
  },
});

/**
 * Replaces all vesselTripEvents rows for one sailing day.
 * This is intended for full backfills and reset-style seeds where we want the
 * complete scheduled event skeleton, including past events.
 */
export const replaceForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(vesselTripEventSchema),
  },
  returns: v.object({
    Deleted: v.number(),
    Inserted: v.number(),
  }),
  handler: async (ctx, args) => {
    validateSailingDayEvents(args.SailingDay, args.Events);

    const existing = await ctx.db
      .query("vesselTripEvents")
      .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.SailingDay))
      .collect();

    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    const dedupedEvents = dedupeEventsById(args.Events).sort(sortVesselTripEvents);

    for (const event of dedupedEvents) {
      await ctx.db.insert("vesselTripEvents", event);
    }

    return {
      Deleted: existing.length,
      Inserted: dedupedEvents.length,
    };
  },
});

/**
 * Applies a batch of live vessel locations to already-seeded vessel/day
 * timeline rows.
 */
export const applyLiveUpdates = internalMutation({
  args: {
    Locations: v.array(vesselLocationValidationSchema),
  },
  returns: v.null(),
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
        // Duplicate keys can exist during transitions, so normalize before
        // applying live predictions to the ordered event sequence.
        dedupeEventsById(toEventRecords(docs)).sort(sortVesselTripEvents),
        location
      );

      for (const duplicateId of getDuplicateEventDocIds(docs)) {
        await ctx.db.delete(duplicateId);
      }

      await persistEventUpserts(ctx, indexEventDocs(docs), updatedEvents);
    }

    return null;
  },
});

/**
 * Deletes vesselTripEvents rows in batches so callers can purge the table
 * without loading everything into one mutation.
 */
export const deleteVesselTripEventsBatch = internalMutation({
  args: {
    limit: v.number(),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const docs = await ctx.db.query("vesselTripEvents").take(args.limit);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    return {
      deleted: docs.length,
      hasMore: docs.length === args.limit,
    };
  },
});

/**
 * Inserts new vessel trip events and replaces existing rows whose event payload
 * has changed.
 *
 * @param ctx - Convex mutation context used to write vessel trip event rows
 * @param existingById - Existing rows keyed by stable event key for lookup
 * @param nextEvents - Event records that should exist after the mutation
 * @returns The number of new rows inserted during the upsert pass
 */
const persistEventUpserts = async (
  ctx: MutationCtx,
  existingById: Map<
    string,
    { _id: Doc<"vesselTripEvents">["_id"]; event: ConvexVesselTripEvent }
  >,
  nextEvents: ConvexVesselTripEvent[]
) => {
  let insertedCount = 0;

  for (const event of nextEvents) {
    const existing = existingById.get(event.Key);

    if (!existing) {
      await ctx.db.insert("vesselTripEvents", event);
      insertedCount += 1;
      continue;
    }

    if (eventsEqual(existing.event, event)) {
      continue;
    }

    // Replace the whole document so stored event fields stay in sync with the
    // canonical domain payload.
    await ctx.db.replace(existing._id, event);
  }

  return insertedCount;
};

/**
 * Builds a map of persisted event documents keyed by event key.
 *
 * @param docs - Stored vessel trip event documents from Convex
 * @returns Document records keyed by stable event key
 */
const indexEventDocs = (docs: Doc<"vesselTripEvents">[]) =>
  new Map(dedupeEventDocs(docs).map((doc) => [doc.event.Key, doc]));

/**
 * Converts persisted Convex documents into plain event records.
 *
 * @param docs - Stored vessel trip event documents from Convex
 * @returns Plain event records without Convex metadata fields
 */
const toEventRecords = (docs: Doc<"vesselTripEvents">[]) =>
  docs.map(toEventRecord);

/**
 * Builds a map of event records keyed by event key.
 *
 * @param events - Event records to index
 * @returns Event records keyed by stable event key
 */
const indexEventsById = (events: ConvexVesselTripEvent[]) =>
  new Map(events.map((event) => [event.Key, event]));

/**
 * Removes duplicate event records by keeping the last record seen for each key.
 *
 * @param events - Event records that may contain duplicate keys
 * @returns A deduplicated event list keyed by stable event key
 */
const dedupeEventsById = (events: ConvexVesselTripEvent[]) =>
  Array.from(indexEventsById(events).values());

/**
 * Removes duplicate persisted documents by keeping the last row seen for each
 * event key.
 *
 * @param docs - Stored vessel trip event documents that may contain duplicates
 * @returns Deduplicated document records with ids preserved for writes
 */
const dedupeEventDocs = (docs: Doc<"vesselTripEvents">[]) =>
  Array.from(
    docs.reduce((byId, doc) => {
      // Later rows win so callers can treat the result as the latest
      // authoritative document per event key.
      byId.set(doc.Key, {
        _id: doc._id,
        event: toEventRecord(doc),
      });
      return byId;
    }, new Map<
      string,
      { _id: Doc<"vesselTripEvents">["_id"]; event: ConvexVesselTripEvent }
    >())
  ).map(([, doc]) => doc);

/**
 * Collects duplicate persisted row ids so callers can clean up dirty state
 * while preserving the last row seen for each event key.
 *
 * @param docs - Stored vessel trip event documents that may contain duplicates
 * @returns Duplicate document ids that are safe to delete
 */
const getDuplicateEventDocIds = (docs: Doc<"vesselTripEvents">[]) => {
  const duplicateIds: Doc<"vesselTripEvents">["_id"][] = [];
  const latestDocIdByKey = new Map<string, Doc<"vesselTripEvents">["_id"]>();

  for (const doc of docs) {
    const previousId = latestDocIdByKey.get(doc.Key);
    if (previousId) {
      duplicateIds.push(previousId);
    }

    latestDocIdByKey.set(doc.Key, doc._id);
  }

  return duplicateIds;
};

/**
 * Compares two event payloads for storage-relevant equality.
 *
 * @param left - Existing stored event payload
 * @param right - Candidate next event payload
 * @returns True when both event payloads are identical for persistence
 */
const eventsEqual = (
  left: ConvexVesselTripEvent,
  right: ConvexVesselTripEvent
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.EventType === right.EventType &&
  left.ScheduledTime === right.ScheduledTime &&
  left.PredictedTime === right.PredictedTime &&
  left.ActualTime === right.ActualTime;

/**
 * Strips Convex document metadata from a persisted vessel trip event row.
 *
 * @param doc - Stored vessel trip event document from Convex
 * @returns Plain event record containing only domain fields
 */
const toEventRecord = (
  doc: Doc<"vesselTripEvents">
): ConvexVesselTripEvent => ({
  Key: doc.Key,
  VesselAbbrev: doc.VesselAbbrev,
  SailingDay: doc.SailingDay,
  ScheduledDeparture: doc.ScheduledDeparture,
  TerminalAbbrev: doc.TerminalAbbrev,
  EventType: doc.EventType,
  ScheduledTime: doc.ScheduledTime,
  PredictedTime: doc.PredictedTime,
  ActualTime: doc.ActualTime,
});

/**
 * Verifies that every seeded event belongs to the requested sailing day.
 *
 * @param SailingDay - Service day being reseeded
 * @param events - Seeded event payloads to validate before persistence
 * @returns Nothing; throws when any event belongs to a different sailing day
 */
export const validateSailingDayEvents = (
  SailingDay: string,
  events: ConvexVesselTripEvent[]
) => {
  for (const event of events) {
    if (event.SailingDay !== SailingDay) {
      throw new Error(
        `reseedForSailingDay expected event ${event.Key} to match sailing day ${SailingDay}, got ${event.SailingDay}`
      );
    }
  }
};
