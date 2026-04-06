/**
 * Internal mutations for the normalized `eventsActual` table.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  buildOccurrenceEffectsFromLocation,
  getLocationSailingDay,
} from "domain/vesselTimeline/events";
import { mergeTimelineEvents } from "domain/vesselTimeline/timelineEvents";
import { buildActualBoundaryEventFromEffect } from "domain/vesselTimeline/normalizedEvents";
import { actualRowsEqual } from "./actualRowsEqual";
import { actualBoundaryEffectSchema } from "./projectionSchemas";

/**
 * Applies sparse actual-time boundary effects emitted by `vesselTrips`.
 *
 * These are incremental overlays, not full-day replacements, so the mutation
 * upserts only the affected keys and skips no-op rewrites.
 *
 * @param args.Effects - Departure and arrival actual effects keyed by segment
 * @returns `null`
 */
export const projectActualBoundaryEffects = internalMutation({
  args: {
    Effects: v.array(actualBoundaryEffectSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertActualBoundaryEffects(ctx, args.Effects);

    return null;
  },
});

/**
 * Reconciles same-day boundary occurrence from current live vessel state after
 * schedule/timeline refreshes.
 */
export const reconcileActualBoundaryOccurrencesForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [scheduledEvents, actualEvents, vesselLocations] = await Promise.all([
      ctx.db
        .query("eventsScheduled")
        .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.SailingDay))
        .collect(),
      ctx.db
        .query("eventsActual")
        .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.SailingDay))
        .collect(),
      ctx.db.query("vesselLocations").collect(),
    ]);

    const scheduledByVessel = new Map<string, typeof scheduledEvents>();
    for (const event of scheduledEvents) {
      const scoped = scheduledByVessel.get(event.VesselAbbrev);
      if (scoped) {
        scoped.push(event);
      } else {
        scheduledByVessel.set(event.VesselAbbrev, [event]);
      }
    }

    const actualByVessel = new Map<string, typeof actualEvents>();
    for (const event of actualEvents) {
      const scoped = actualByVessel.get(event.VesselAbbrev);
      if (scoped) {
        scoped.push(event);
      } else {
        actualByVessel.set(event.VesselAbbrev, [event]);
      }
    }

    const effects = vesselLocations.flatMap((location) => {
      if (getLocationSailingDay(location) !== args.SailingDay) {
        return [];
      }

      const vesselScheduledEvents = scheduledByVessel.get(location.VesselAbbrev);
      if (!vesselScheduledEvents || vesselScheduledEvents.length === 0) {
        return [];
      }

      return buildOccurrenceEffectsFromLocation(
        mergeTimelineEvents({
          scheduledEvents: vesselScheduledEvents,
          actualEvents: actualByVessel.get(location.VesselAbbrev) ?? [],
          predictedEvents: [],
        }),
        location
      );
    });

    await upsertActualBoundaryEffects(ctx, effects);
    return null;
  },
});

const upsertActualBoundaryEffects = async (
  ctx: MutationCtx,
  effects: Array<Infer<typeof actualBoundaryEffectSchema>>
) => {
  const updatedAt = Date.now();
  const nextRowsByKey = new Map(
    effects.map((effect) => {
      const row = buildActualBoundaryEventFromEffect(effect, updatedAt);
      return [row.Key, row] as const;
    })
  );

  for (const [Key, candidateRow] of nextRowsByKey) {
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_key", (q) => q.eq("Key", Key))
      .unique();
    const nextRow = mergeWithExistingActualRow(existing, candidateRow);

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

const mergeWithExistingActualRow = (
  existing:
    | {
        EventActualTime?: number;
      }
    | null,
  nextRow: ReturnType<typeof buildActualBoundaryEventFromEffect>
) => ({
  ...nextRow,
  EventOccurred: true as const,
  EventActualTime: nextRow.EventActualTime ?? existing?.EventActualTime,
});
