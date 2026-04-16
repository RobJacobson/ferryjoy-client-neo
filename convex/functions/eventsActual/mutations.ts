/**
 * Internal mutations for the normalized `eventsActual` table.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import {
  hasTripKeyOnActualDockWrite,
  isPersistableActualDockWrite,
  mergeActualDockWriteWithExistingRow,
} from "domain/timelineRows/actualDockWriteHelpers";
import { buildActualDockEventFromWrite } from "domain/timelineRows/buildActualRows";
import { actualDockRowsEqual } from "shared/actualDockRowsEqual";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";
import {
  actualDockWriteSchema,
  type ConvexActualDockWriteWithTripKey,
} from "./schemas";

/**
 * Applies sparse actual-time dock writes emitted by `vesselTrips`.
 *
 * These are incremental overlays, not full-day replacements, so the mutation
 * upserts only the affected `EventKey` values and skips no-op rewrites.
 *
 * @param ctx - Convex internal mutation context
 * @param args - Mutation arguments containing departure and arrival writes
 * @returns `null`
 */
export const projectActualDockWrites = internalMutation({
  args: {
    Writes: v.array(actualDockWriteSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertActualDockWrites(
      ctx,
      args.Writes.filter(hasTripKeyOnActualDockWrite)
    );

    return null;
  },
});

/**
 * Upserts writes by physical `EventKey` (clean-slate: no legacy boundary Key).
 *
 * @param ctx - Convex mutation context
 * @param writes - Writes with resolved `TripKey` (caller filters inbound args)
 * @returns `undefined` after the upsert pass completes
 */
const upsertActualDockWrites = async (
  ctx: MutationCtx,
  writes: ConvexActualDockWriteWithTripKey[]
) => {
  const updatedAt = Date.now();
  const dedupedByEventKey = new Map<string, ConvexActualDockWriteWithTripKey>();

  for (const write of writes) {
    const eventKey =
      write.EventKey ??
      buildPhysicalActualEventKey(write.TripKey, write.EventType);
    dedupedByEventKey.set(eventKey, write);
  }

  for (const write of dedupedByEventKey.values()) {
    const eventKey =
      write.EventKey ??
      buildPhysicalActualEventKey(write.TripKey, write.EventType);
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", eventKey))
      .unique();

    const mergedWrite = mergeActualDockWriteWithExistingRow(
      write,
      existing ?? undefined
    );

    if (!isPersistableActualDockWrite(mergedWrite)) {
      continue;
    }

    const candidateRow = buildActualDockEventFromWrite(mergedWrite, updatedAt);
    const nextRow = mergeWithExistingActualRow(existing, candidateRow);

    if (!existing) {
      await ctx.db.insert("eventsActual", nextRow);
      continue;
    }

    if (actualDockRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

/**
 * Merges optional fields from an existing row when the write omits them.
 *
 * @param existing - Current document or null
 * @param nextRow - Candidate row from the write
 * @returns Row to write
 */
const mergeWithExistingActualRow = (
  existing: {
    EventActualTime?: number;
  } | null,
  nextRow: ReturnType<typeof buildActualDockEventFromWrite>
) => ({
  ...nextRow,
  EventOccurred: true as const,
  EventActualTime: nextRow.EventActualTime ?? existing?.EventActualTime,
});
