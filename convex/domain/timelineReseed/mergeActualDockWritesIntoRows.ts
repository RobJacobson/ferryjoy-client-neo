/**
 * Merges sparse actual dock writes into base actual rows for reseed.
 */

import type {
  ConvexActualDockEvent,
  ConvexActualDockWriteWithTripKey,
} from "../../domain/events/actual/schemas";
import { buildPhysicalActualEventKey } from "../../shared/physicalTripIdentity";
import {
  isPersistableActualDockWrite,
  mergeActualDockWriteWithExistingRow,
} from "../timelineRows/actualDockWriteHelpers";
import { buildActualDockEventFromWrite } from "../timelineRows/buildActualRows";

/**
 * Merges sparse actual dock writes into base rows keyed by `EventKey`.
 */
export const mergeActualDockWritesIntoRows = (
  baseRows: ConvexActualDockEvent[],
  writes: ConvexActualDockWriteWithTripKey[],
  updatedAt: number
): ConvexActualDockEvent[] => {
  const byEventKey = new Map(baseRows.map((row) => [row.EventKey, row]));

  for (const write of writes) {
    const eventKey =
      write.EventKey ??
      buildPhysicalActualEventKey(write.TripKey, write.EventType);
    const existing = byEventKey.get(eventKey);
    const mergedWrite = mergeActualDockWriteWithExistingRow(write, existing);

    if (!isPersistableActualDockWrite(mergedWrite)) {
      continue;
    }

    const candidate = buildActualDockEventFromWrite(mergedWrite, updatedAt);
    byEventKey.set(candidate.EventKey, {
      ...candidate,
      EventOccurred: true,
      EventActualTime: candidate.EventActualTime ?? existing?.EventActualTime,
    });
  }

  return [...byEventKey.values()];
};
