/**
 * Validators and types for `eventsActual`: persisted table rows, sparse
 * projection **patches**, and domain conversion helpers.
 *
 * PR3: persisted rows are physical-first: `EventKey` is the durable id
 * (`buildPhysicalActualEventKey(TripKey, EventType)`). Legacy schedule-shaped
 * `Key` is not stored.
 *
 * **TripKey:** Optional only on {@link ConvexActualBoundaryPatch} at ingestion
 * / pre-enrichment. Any patch that is persisted or normalized into a row must
 * include `TripKey`. If it cannot be resolved upstream, skip persistence.
 *
 * **Anchor timestamps:** Normalization and DB writes require at least one of
 * `EventActualTime` or `ScheduledDeparture` (ms). Use
 * {@link ConvexActualBoundaryPatchPersistable} for that contract; fill missing
 * anchors earlier (trip builders, merge with an existing row, enrichment).
 *
 * Use {@link ConvexActualBoundaryPatch} at ingestion boundaries;
 * {@link hasTripKey} after physical identity is resolved; {@link isPersistableActualBoundaryPatch}
 * (or merge with an existing row) before {@link buildActualBoundaryEventFromPatch}.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { epochMsToDate } from "../../shared/convertDates";
import { boundaryEventTypeSchema } from "../eventsScheduled/schemas";

/**
 * Persisted row fields (physical `TripKey` required).
 */
const persistedActualBoundaryFields = {
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
  ...persistedActualBoundaryFields,
  EventKey: v.string(),
  EventType: boundaryEventTypeSchema,
  UpdatedAt: v.number(),
  EventOccurred: v.optional(v.literal(true)),
});

export type ConvexActualBoundaryEvent = Infer<typeof eventsActualSchema>;

/**
 * Sparse actual patch at ingestion / pre-enrichment. `TripKey` is optional
 * here only; persisted and normalized rows require it. `SegmentKey` is optional
 * when only physical facts exist.
 *
 * `EventKey` may be omitted; normalization derives it from `TripKey` +
 * `EventType` once the patch is {@link ConvexActualBoundaryPatchPersistable}.
 */
export const actualBoundaryPatchSchema = v.object({
  TripKey: v.optional(v.string()),
  ScheduleKey: v.optional(v.string()),
  VesselAbbrev: v.string(),
  /** When omitted, `buildActualBoundaryEventFromPatch` derives from `EventActualTime`. */
  SailingDay: v.optional(v.string()),
  /** When omitted, `buildActualBoundaryEventFromPatch` uses `EventActualTime` (ms). */
  ScheduledDeparture: v.optional(v.number()),
  TerminalAbbrev: v.string(),
  EventActualTime: v.optional(v.number()),
  SegmentKey: v.optional(v.string()),
  EventType: boundaryEventTypeSchema,
  EventOccurred: v.literal(true),
  EventKey: v.optional(v.string()),
});

/**
 * Broad external / pre-enrichment patch shape (validator-aligned).
 */
export type ConvexActualBoundaryPatch = Infer<typeof actualBoundaryPatchSchema>;

/**
 * Fields shared by all actual boundary patches except optional physical `TripKey`.
 */
export type ConvexActualBoundaryPatchBase = Omit<
  ConvexActualBoundaryPatch,
  "TripKey"
>;

/**
 * Patch after physical identity resolution: `TripKey` is required. May still
 * lack an anchor timestamp until merged with an existing row or enriched.
 */
export type ConvexActualBoundaryPatchWithTripKey =
  ConvexActualBoundaryPatchBase & {
    TripKey: string;
  };

/**
 * At least one anchor timestamp (ms) for persistence and normalization.
 */
export type ActualBoundaryPatchAnchor =
  | { EventActualTime: number; ScheduledDeparture?: number }
  | { EventActualTime?: number; ScheduledDeparture: number };

/**
 * Patch ready to normalize into a persisted `eventsActual` row: `TripKey`
 * plus at least one of `EventActualTime` or `ScheduledDeparture`.
 */
export type ConvexActualBoundaryPatchPersistable =
  ConvexActualBoundaryPatchBase & {
    TripKey: string;
  } & ActualBoundaryPatchAnchor;

/**
 * Narrows a patch after `TripKey` enrichment (ingestion / mutation entry).
 *
 * @param patch - Sparse patch that may still lack `TripKey`
 * @returns Whether `TripKey` is defined
 */
export const hasTripKey = (
  patch: ConvexActualBoundaryPatch
): patch is ConvexActualBoundaryPatchWithTripKey => patch.TripKey !== undefined;

/**
 * True when the patch has a `TripKey` and at least one anchor timestamp.
 * Merge flows may use {@link mergeActualBoundaryPatchWithExistingRow} first so
 * an existing row can supply a missing anchor.
 *
 * @param patch - Patch with resolved `TripKey`
 * @returns Whether the patch is safe for `buildActualBoundaryEventFromPatch`
 */
export const isPersistableActualBoundaryPatch = (
  patch: ConvexActualBoundaryPatchWithTripKey
): patch is ConvexActualBoundaryPatchPersistable =>
  patch.EventActualTime !== undefined || patch.ScheduledDeparture !== undefined;

/**
 * Fills omitted schedule/actual fields from an existing `eventsActual` row
 * when applying a patch (supersession / same-day merge).
 *
 * @param patch - Patch with resolved `TripKey`
 * @param existing - Current row for the same `EventKey`, if any
 * @returns Patch fields merged for the next persistability check
 */
export const mergeActualBoundaryPatchWithExistingRow = (
  patch: ConvexActualBoundaryPatchWithTripKey,
  existing: ConvexActualBoundaryEvent | undefined
): ConvexActualBoundaryPatchWithTripKey => ({
  ...patch,
  TripKey: patch.TripKey,
  EventActualTime: patch.EventActualTime ?? existing?.EventActualTime,
  ScheduledDeparture: patch.ScheduledDeparture ?? existing?.ScheduledDeparture,
  SailingDay: patch.SailingDay ?? existing?.SailingDay,
});

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
