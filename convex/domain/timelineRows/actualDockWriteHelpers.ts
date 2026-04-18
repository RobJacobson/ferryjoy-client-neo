/**
 * Pure helpers for sparse `eventsActual` dock writes: trip-key narrowing,
 * persistability, and merge-with-existing before normalization.
 */

import type {
  ConvexActualDockEvent,
  ConvexActualDockWrite,
  ConvexActualDockWritePersistable,
  ConvexActualDockWriteWithTripKey,
} from "../../domain/events/actual/schemas";

/**
 * Narrows a write after `TripKey` enrichment (ingestion / mutation entry).
 *
 * @param write - Sparse write that may still lack `TripKey`
 * @returns Whether `TripKey` is defined
 */
export const hasTripKeyOnActualDockWrite = (
  write: ConvexActualDockWrite
): write is ConvexActualDockWriteWithTripKey => write.TripKey !== undefined;

/**
 * True when the write has a `TripKey` and at least one anchor timestamp.
 * Merge flows may use {@link mergeActualDockWriteWithExistingRow} first so an
 * existing row can supply a missing anchor.
 *
 * @param write - Write with resolved `TripKey`
 * @returns Whether the write is safe for `buildActualDockEventFromWrite`
 */
export const isPersistableActualDockWrite = (
  write: ConvexActualDockWriteWithTripKey
): write is ConvexActualDockWritePersistable =>
  write.EventActualTime !== undefined || write.ScheduledDeparture !== undefined;

/**
 * Fills omitted schedule/actual fields from an existing `eventsActual` row when
 * applying a write (supersession / same-day merge).
 *
 * @param write - Write with resolved `TripKey`
 * @param existing - Current row for the same `EventKey`, if any
 * @returns Write fields merged for the next persistability check
 */
export const mergeActualDockWriteWithExistingRow = (
  write: ConvexActualDockWriteWithTripKey,
  existing: ConvexActualDockEvent | undefined
): ConvexActualDockWriteWithTripKey => ({
  ...write,
  TripKey: write.TripKey,
  EventActualTime: write.EventActualTime ?? existing?.EventActualTime,
  ScheduledDeparture: write.ScheduledDeparture ?? existing?.ScheduledDeparture,
  SailingDay: write.SailingDay ?? existing?.SailingDay,
});
