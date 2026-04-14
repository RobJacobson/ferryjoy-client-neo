/**
 * Merges sparse actual-boundary patches into base actual rows for reseed.
 */

import {
  type ConvexActualBoundaryEvent,
  type ConvexActualBoundaryPatchWithTripKey,
  isPersistableActualBoundaryPatch,
  mergeActualBoundaryPatchWithExistingRow,
} from "../../functions/eventsActual/schemas";
import { buildPhysicalActualEventKey } from "../../shared/physicalTripIdentity";
import { buildActualBoundaryEventFromPatch } from "../timelineRows";

/**
 * Merges sparse actual-boundary patches into base rows keyed by `EventKey`.
 */
export const mergeActualBoundaryPatchesIntoRows = (
  baseRows: ConvexActualBoundaryEvent[],
  patches: ConvexActualBoundaryPatchWithTripKey[],
  updatedAt: number
): ConvexActualBoundaryEvent[] => {
  const byEventKey = new Map(baseRows.map((row) => [row.EventKey, row]));

  for (const patch of patches) {
    const eventKey =
      patch.EventKey ??
      buildPhysicalActualEventKey(patch.TripKey, patch.EventType);
    const existing = byEventKey.get(eventKey);
    const mergedPatch = mergeActualBoundaryPatchWithExistingRow(
      patch,
      existing
    );

    if (!isPersistableActualBoundaryPatch(mergedPatch)) {
      continue;
    }

    const candidate = buildActualBoundaryEventFromPatch(mergedPatch, updatedAt);
    byEventKey.set(candidate.EventKey, {
      ...candidate,
      EventOccurred: true,
      EventActualTime: candidate.EventActualTime ?? existing?.EventActualTime,
    });
  }

  return [...byEventKey.values()];
};
