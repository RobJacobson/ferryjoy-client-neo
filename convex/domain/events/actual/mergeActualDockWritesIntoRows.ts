/**
 * Merges sparse actual dock writes into base actual rows.
 *
 * Reload code uses this helper after live-location reconciliation proposes
 * additional actual dock writes for the sailing-day slice.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildPhysicalActualEventKey } from "../../../shared/physicalTripIdentity";
import {
  isPersistableActualDockWrite,
  mergeActualDockWriteWithExistingRow,
} from "./actualDockWriteHelpers";
import { buildActualDockEventFromWrite } from "./buildActualDockEvents";
import type { ConvexActualDockWriteWithTripKey } from "./types";

/**
 * Folds sparse writes into an in-memory map of actual rows by EventKey.
 *
 * For each write, the merge combines with any existing row for the same
 * physical EventKey so partial patches retain prior timestamps, then rebuilds
 * the persisted shape through buildActualDockEventFromWrite. EventOccurred and
 * EventActualTime are reconciled so downstream consumers never lose an arrival
 * time when a patch omits it but the base row had one.
 *
 * @param baseRows - Existing actual rows for the reload slice
 * @param writes - Sparse actual writes proposed during reconciliation
 * @param updatedAt - Timestamp to stamp onto inserted or changed rows
 * @returns Full row list after merging every persistable write
 */
const mergeActualDockWritesIntoRows = (
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

export { mergeActualDockWritesIntoRows };
