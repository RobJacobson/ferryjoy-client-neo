/**
 * Internal mutations for the normalized `eventsActual` table.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { buildActualBoundaryEventFromPatch } from "domain/vesselTimeline/normalizedEvents";
import { actualBoundaryRowsEqual } from "shared/actualBoundaryRowsEqual";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";
import {
  actualBoundaryPatchSchema,
  type ConvexActualBoundaryPatchWithTripKey,
  hasTripKey,
  isPersistableActualBoundaryPatch,
  mergeActualBoundaryPatchWithExistingRow,
} from "./schemas";

/**
 * Applies sparse actual-time boundary patches emitted by `vesselTrips`.
 *
 * These are incremental overlays, not full-day replacements, so the mutation
 * upserts only the affected `EventKey` values and skips no-op rewrites.
 *
 * @param args.Patches - Departure and arrival patches with `TripKey`
 * @returns `null`
 */
export const projectActualBoundaryPatches = internalMutation({
  args: {
    Patches: v.array(actualBoundaryPatchSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertActualBoundaryPatches(ctx, args.Patches.filter(hasTripKey));

    return null;
  },
});

/**
 * Upserts patches by physical `EventKey` (clean-slate: no legacy boundary Key).
 *
 * @param ctx - Convex mutation context
 * @param patches - Patches with resolved `TripKey` (caller filters inbound args)
 */
const upsertActualBoundaryPatches = async (
  ctx: MutationCtx,
  patches: ConvexActualBoundaryPatchWithTripKey[]
) => {
  const updatedAt = Date.now();
  const dedupedByEventKey = new Map<
    string,
    ConvexActualBoundaryPatchWithTripKey
  >();

  for (const patch of patches) {
    const eventKey =
      patch.EventKey ??
      buildPhysicalActualEventKey(patch.TripKey, patch.EventType);
    dedupedByEventKey.set(eventKey, patch);
  }

  for (const patch of dedupedByEventKey.values()) {
    const eventKey =
      patch.EventKey ??
      buildPhysicalActualEventKey(patch.TripKey, patch.EventType);
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", eventKey))
      .unique();

    const mergedPatch = mergeActualBoundaryPatchWithExistingRow(
      patch,
      existing ?? undefined
    );

    if (!isPersistableActualBoundaryPatch(mergedPatch)) {
      continue;
    }

    const candidateRow = buildActualBoundaryEventFromPatch(
      mergedPatch,
      updatedAt
    );
    const nextRow = mergeWithExistingActualRow(existing, candidateRow);

    if (!existing) {
      await ctx.db.insert("eventsActual", nextRow);
      continue;
    }

    if (actualBoundaryRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

/**
 * Merges optional fields from an existing row when the patch omits them.
 *
 * @param existing - Current document or null
 * @param nextRow - Candidate row from the patch
 * @returns Row to write
 */
const mergeWithExistingActualRow = (
  existing: {
    EventActualTime?: number;
  } | null,
  nextRow: ReturnType<typeof buildActualBoundaryEventFromPatch>
) => ({
  ...nextRow,
  EventOccurred: true as const,
  EventActualTime: nextRow.EventActualTime ?? existing?.EventActualTime,
});
