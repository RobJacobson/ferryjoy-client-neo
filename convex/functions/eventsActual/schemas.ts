/**
 * Validators and types for `eventsActual`: persisted table rows and sparse
 * dock **writes** at ingestion boundaries.
 *
 * PR3: persisted rows are physical-first: `EventKey` is the durable id
 * (`buildPhysicalActualEventKey(TripKey, EventType)`). Legacy schedule-shaped
 * `Key` is not stored.
 *
 * **TripKey:** Optional only on {@link ConvexActualDockWrite} at ingestion /
 * pre-enrichment. Any write that is persisted or normalized into a row must
 * include `TripKey`. If it cannot be resolved upstream, skip persistence.
 *
 * **Anchor timestamps:** Normalization and DB writes require at least one of
 * `EventActualTime` or `ScheduledDeparture` (ms). Use
 * {@link ConvexActualDockWritePersistable} for that contract; fill missing
 * anchors earlier (trip builders, merge with an existing row, enrichment).
 *
 * Use `ConvexActualDockWrite` at ingestion boundaries; narrow with
 * `hasTripKeyOnActualDockWrite` / `isPersistableActualDockWrite` in
 * `actualDockWriteHelpers` after physical identity is resolved; normalize with
 * `buildActualDockEventFromWrite` in `buildActualRows`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "../eventsScheduled/schemas";

/**
 * Persisted row fields (physical `TripKey` required).
 */
const persistedActualDockFields = {
  TripKey: v.string(),
  ScheduleKey: v.optional(v.string()),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventActualTime: v.optional(v.number()),
} as const;

/**
 * Convex validator for one **persisted** `eventsActual` document.
 *
 * Identity is `EventKey` (physical). `EventType` is first-class. Optional
 * `ScheduleKey` is schedule alignment only.
 */
export const eventsActualSchema = v.object({
  ...persistedActualDockFields,
  EventKey: v.string(),
  EventType: dockEventTypeSchema,
  UpdatedAt: v.number(),
  EventOccurred: v.optional(v.literal(true)),
});

export type ConvexActualDockEvent = Infer<typeof eventsActualSchema>;

/**
 * Sparse actual dock write at ingestion / pre-enrichment. `TripKey` is optional
 * here only; persisted and normalized rows require it. `SegmentKey` is optional
 * when only physical facts exist.
 *
 * `EventKey` may be omitted; normalization derives it from `TripKey` +
 * `EventType` once the write is {@link ConvexActualDockWritePersistable}.
 */
export const actualDockWriteSchema = v.object({
  TripKey: v.optional(v.string()),
  ScheduleKey: v.optional(v.string()),
  VesselAbbrev: v.string(),
  /** When omitted, `buildActualDockEventFromWrite` derives from `EventActualTime`. */
  SailingDay: v.optional(v.string()),
  /** When omitted, `buildActualDockEventFromWrite` uses `EventActualTime` (ms). */
  ScheduledDeparture: v.optional(v.number()),
  TerminalAbbrev: v.string(),
  EventActualTime: v.optional(v.number()),
  SegmentKey: v.optional(v.string()),
  EventType: dockEventTypeSchema,
  EventOccurred: v.literal(true),
  EventKey: v.optional(v.string()),
});

/**
 * Broad external / pre-enrichment write shape (validator-aligned).
 */
export type ConvexActualDockWrite = Infer<typeof actualDockWriteSchema>;

/**
 * Fields shared by all actual dock writes except optional physical `TripKey`.
 */
export type ConvexActualDockWriteBase = Omit<ConvexActualDockWrite, "TripKey">;

/**
 * Write after physical identity resolution: `TripKey` is required. May still
 * lack an anchor timestamp until merged with an existing row or enriched.
 */
export type ConvexActualDockWriteWithTripKey = ConvexActualDockWriteBase & {
  TripKey: string;
};

/**
 * At least one anchor timestamp (ms) for persistence and normalization.
 */
export type ActualDockWriteAnchor =
  | { EventActualTime: number; ScheduledDeparture?: number }
  | { EventActualTime?: number; ScheduledDeparture: number };

/**
 * Write ready to normalize into a persisted `eventsActual` row: `TripKey`
 * plus at least one of `EventActualTime` or `ScheduledDeparture`.
 */
export type ConvexActualDockWritePersistable = ConvexActualDockWriteBase & {
  TripKey: string;
} & ActualDockWriteAnchor;
