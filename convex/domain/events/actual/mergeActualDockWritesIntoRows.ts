/**
 * Merges sparse actual dock writes into base actual rows.
 *
 * Reload code uses this helper after live-location reconciliation proposes
 * additional actual dock writes for the sailing-day slice.
 */

import { buildPhysicalActualEventKey } from "../../../shared/physicalTripIdentity";
import {
  isPersistableActualDockWrite,
  mergeActualDockWriteWithExistingRow,
} from "./actualDockWriteHelpers";
import { buildActualDockEventFromWrite } from "./buildActualDockEvents";
import type {
  ConvexActualDockEvent,
  ConvexActualDockWriteWithTripKey,
} from "./schemas";

/**
 * Merges sparse actual dock writes into base rows keyed by `EventKey`.
 *
 * @param baseRows - Existing actual rows for the reload slice
 * @param writes - Sparse actual writes proposed during reconciliation
 * @param updatedAt - Timestamp to stamp onto inserted or changed rows
 * @returns Actual rows with valid sparse writes folded in
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
