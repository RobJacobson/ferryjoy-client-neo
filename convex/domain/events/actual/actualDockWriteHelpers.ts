/**
 * Pure helpers for sparse eventsActual dock writes: trip-key narrowing,
 * persistability, and merge-with-existing before normalization.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type {
  ConvexActualDockWrite,
  ConvexActualDockWritePersistable,
  ConvexActualDockWriteWithTripKey,
} from "./types";

/**
 * Narrows a sparse write once TripKey enrichment may have run.
 *
 * Upstream reconciliation emits ConvexActualDockWrite objects that may still
 * lack TripKey until segment indexes run. This guard lets TypeScript and
 * callers branch before persistability checks.
 *
 * @param write - Sparse write that may still lack TripKey
 * @returns True when TripKey is defined
 */
const hasTripKeyOnActualDockWrite = (
  write: ConvexActualDockWrite
): write is ConvexActualDockWriteWithTripKey => write.TripKey !== undefined;

/**
 * True when the write has TripKey and at least one anchor timestamp.
 *
 * Sparse patches may carry only partial clocks; mergeActualDockWriteWithExistingRow
 * can lift missing anchors from an existing row. After that merge, this check
 * decides whether buildActualDockEventFromWrite is safe to call.
 *
 * @param write - Write with resolved TripKey
 * @returns True when EventActualTime or ScheduledDeparture is present
 */
const isPersistableActualDockWrite = (
  write: ConvexActualDockWriteWithTripKey
): write is ConvexActualDockWritePersistable =>
  write.EventActualTime !== undefined || write.ScheduledDeparture !== undefined;

/**
 * Fills omitted schedule and actual fields from an existing eventsActual row.
 *
 * Same-day reload merges live-location patches with rows already built from
 * schedule or physical trips. Carrying forward prior EventActualTime or
 * ScheduledDeparture avoids dropping persistability when a patch only updates
 * part of the boundary state.
 *
 * @param write - Write with resolved TripKey (possibly sparse anchors)
 * @param existing - Current row for the same EventKey when one exists
 * @returns Merged write suitable for isPersistableActualDockWrite
 */
const mergeActualDockWriteWithExistingRow = (
  write: ConvexActualDockWriteWithTripKey,
  existing: ConvexActualDockEvent | undefined
): ConvexActualDockWriteWithTripKey => ({
  ...write,
  TripKey: write.TripKey,
  EventActualTime: write.EventActualTime ?? existing?.EventActualTime,
  ScheduledDeparture: write.ScheduledDeparture ?? existing?.ScheduledDeparture,
  SailingDay: write.SailingDay ?? existing?.SailingDay,
});

export {
  hasTripKeyOnActualDockWrite,
  isPersistableActualDockWrite,
  mergeActualDockWriteWithExistingRow,
};
