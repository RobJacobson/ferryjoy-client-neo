/**
 * Internal mutations for the normalized VesselTimeline boundary-event tables.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import {
  normalizeScheduledDockSeams,
  sortVesselTripEvents,
} from "domain/vesselTimeline/events";
import {
  buildActualBoundaryEventFromEffect,
  buildActualBoundaryEvents,
  buildScheduledBoundaryEvents,
} from "domain/vesselTimeline/normalizedEvents";
import type { ConvexPredictedBoundaryEvent } from "../eventsPredicted/schemas";
import {
  actualBoundaryEffectSchema,
  type ConvexPredictedBoundaryProjectionRow,
  predictedBoundaryProjectionEffectSchema,
  vesselTimelineEventRecordSchema,
} from "./schemas";

/**
 * Replaces the structural scheduled backbone and hydrated actual rows for one
 * sailing day.
 *
 * Schedule sync owns this mutation. It treats the supplied day slice as the
 * complete truth and makes the normalized tables match it exactly.
 *
 * @param args.SailingDay - Service day being fully replaced
 * @param args.Events - Boundary events already normalized in memory
 * @returns Counts for the rows represented by that replaced slice
 */
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
    const events = normalizeScheduledDockSeams(args.Events).sort(
      sortVesselTripEvents
    );

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
      ActualCount: events.filter((event) => event.EventActualTime !== undefined)
        .length,
    };
  },
});

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
    const updatedAt = Date.now();
    const nextRowsByKey = new Map(
      args.Effects.map((effect) => {
        const row = buildActualBoundaryEventFromEffect(effect, updatedAt);
        return [row.Key, row] as const;
      })
    );

    for (const [Key, nextRow] of nextRowsByKey) {
      const existing = await ctx.db
        .query("eventsActual")
        .withIndex("by_key", (q) => q.eq("Key", Key))
        .unique();

      if (!existing) {
        await ctx.db.insert("eventsActual", nextRow);
        continue;
      }

      if (actualRowsEqual(existing, nextRow)) {
        continue;
      }

      await ctx.db.replace(existing._id, nextRow);
    }

    return null;
  },
});

/**
 * Applies sparse predicted-time boundary effects emitted by `vesselTrips`.
 *
 * Each effect carries both the replacement rows and the key scope that should
 * exist afterwards, which lets the mutation delete stale predictions without
 * reloading unrelated vessels or sailing days.
 *
 * @param args.Effects - Prediction projection effects grouped by vessel/day scope
 * @returns `null`
 */
export const projectPredictedBoundaryEffects = internalMutation({
  args: {
    Effects: v.array(predictedBoundaryProjectionEffectSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const effectsByScope = new Map<
      string,
      {
        VesselAbbrev: string;
        SailingDay: string;
        TargetKeys: Set<string>;
        RowsByKey: Map<string, ConvexPredictedBoundaryProjectionRow>;
      }
    >();

    for (const effect of args.Effects) {
      // Multiple vessels in the same tick may emit overlapping prediction
      // effects for the same vessel/day scope. Merge them first so we only
      // read and rewrite that scope once.
      const scopeKey = `${effect.VesselAbbrev}:${effect.SailingDay}`;
      const existingScope = effectsByScope.get(scopeKey);

      if (existingScope) {
        for (const targetKey of effect.TargetKeys) {
          existingScope.TargetKeys.add(targetKey);
        }
        for (const row of effect.Rows) {
          existingScope.RowsByKey.set(row.Key, row);
        }
        continue;
      }

      effectsByScope.set(scopeKey, {
        VesselAbbrev: effect.VesselAbbrev,
        SailingDay: effect.SailingDay,
        TargetKeys: new Set(effect.TargetKeys),
        RowsByKey: new Map(effect.Rows.map((row) => [row.Key, row])),
      });
    }

    for (const effect of effectsByScope.values()) {
      if (effect.TargetKeys.size === 0) {
        continue;
      }

      const existingRows = await ctx.db
        .query("eventsPredicted")
        .withIndex("by_vessel_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", effect.VesselAbbrev)
            .eq("SailingDay", effect.SailingDay)
        )
        .collect();

      for (const existing of existingRows) {
        if (
          effect.TargetKeys.has(existing.Key) &&
          !effect.RowsByKey.has(existing.Key)
        ) {
          await ctx.db.delete(existing._id);
        }
      }

      for (const [Key, row] of effect.RowsByKey) {
        if (!effect.TargetKeys.has(Key)) {
          continue;
        }

        const nextRow = {
          ...row,
          UpdatedAt: updatedAt,
        };
        const existing = existingRows.find(
          (existingRow) => existingRow.Key === Key
        );

        if (!existing) {
          await ctx.db.insert("eventsPredicted", nextRow);
          continue;
        }

        if (predictedRowsEqual(existing, nextRow)) {
          continue;
        }

        await ctx.db.replace(existing._id, nextRow);
      }
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
  left.EventScheduledTime === right.EventScheduledTime;

const actualRowsEqual = (
  left: Doc<"eventsActual">,
  right: ReturnType<typeof buildActualBoundaryEvents>[number]
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.EventActualTime === right.EventActualTime;

const predictedRowsEqual = (
  left: Doc<"eventsPredicted">,
  right: ConvexPredictedBoundaryEvent
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.EventPredictedTime === right.EventPredictedTime &&
  left.PredictionType === right.PredictionType &&
  left.PredictionSource === right.PredictionSource;
