/**
 * Validators and types for `eventsActual`: persisted table rows, sparse
 * projection **patches**, and domain conversion helpers.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { epochMsToDate } from "../../shared/convertDates";
import { boundaryEventTypeSchema } from "../eventsScheduled/schemas";

/**
 * Shared field validators for persisted actual rows and sparse projection
 * patches. Same approach as `vesselLocationBaseValidationFields` in
 * [`vesselLocation/schemas.ts`](../vesselLocation/schemas.ts): a `const`
 * object with `as const`, spread into each `v.object({ ... })`.
 *
 * `EventOccurred` is intentionally omitted here: table rows use optional
 * `v.literal(true)`; patches use required `v.literal(true)` (different
 * validators, same runtime values when set).
 */
const actualBoundarySharedFields = {
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventActualTime: v.optional(v.number()),
} as const;

/**
 * Convex validator for one **persisted** `eventsActual` document.
 *
 * Spreads {@link actualBoundarySharedFields}, then adds row-only fields.
 * Compared to {@link actualBoundaryPatchSchema} (projection input):
 * - **Identity:** stores `Key` (full boundary key). Patches carry `SegmentKey`
 *   plus `EventType`; `buildActualBoundaryEventFromPatch` derives `Key`.
 * - **Stamping:** includes `UpdatedAt`. Patches omit it; mutations set it at
 *   write time.
 * - **Confirmed boundary:** `EventOccurred` is optional so legacy rows that only
 *   set `EventActualTime` remain valid. Patches always set `EventOccurred: true`
 *   (literal on the patch schema).
 * - **Shape:** no separate `EventType` column; arrival vs departure is encoded
 *   in `Key`.
 */
export const eventsActualSchema = v.object({
  ...actualBoundarySharedFields,
  Key: v.string(),
  UpdatedAt: v.number(),
  EventOccurred: v.optional(v.literal(true)),
});

export type ConvexActualBoundaryEvent = Infer<typeof eventsActualSchema>;

/**
 * Convex validator for a **sparse actual patch** (trip-driven or live-location
 * deltas during same-day replace) before it is turned into a full row.
 *
 * Spreads {@link actualBoundarySharedFields}, then adds patch-only fields.
 * **Differs** from {@link eventsActualSchema} as described there (segment
 * identity, no `UpdatedAt`, required `EventOccurred: true` literal, explicit
 * `EventType`).
 */
export const actualBoundaryPatchSchema = v.object({
  ...actualBoundarySharedFields,
  SegmentKey: v.string(),
  EventType: boundaryEventTypeSchema,
  EventOccurred: v.literal(true),
});

export type ConvexActualBoundaryPatch = Infer<typeof actualBoundaryPatchSchema>;

/**
 * Converts an actual boundary event into the domain shape with `Date`
 * instances.
 *
 * @param event - Actual boundary event using epoch milliseconds
 * @returns Actual boundary event with `Date` instances
 */
export const toDomainActualBoundaryEvent = (
  event: ConvexActualBoundaryEvent
) => ({
  ...event,
  EventOccurred: event.EventOccurred ?? true,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventActualTime:
    event.EventActualTime !== undefined
      ? epochMsToDate(event.EventActualTime)
      : undefined,
});

export type ActualBoundaryEvent = ReturnType<
  typeof toDomainActualBoundaryEvent
>;
