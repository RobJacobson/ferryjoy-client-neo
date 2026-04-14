/**
 * Merges sparse `ConvexActualBoundaryPatch` payloads into base `eventsActual`
 * row shapes for same-day replace flows (hydration + live-location deltas).
 */

import { buildActualBoundaryEventFromPatch } from "domain/timelineRows";
import { buildPhysicalActualEventKey } from "../../shared/physicalTripIdentity";
import {
  type ConvexActualBoundaryEvent,
  type ConvexActualBoundaryPatchWithTripKey,
  isPersistableActualBoundaryPatch,
  mergeActualBoundaryPatchWithExistingRow,
} from "../eventsActual/schemas";

/**
 * Merges sparse actual-boundary patches into base rows: each patch becomes a
 * candidate row keyed by `EventKey`. Patches must carry `TripKey` (after
 * enrichment). A merged patch must have an anchor timestamp (`EventActualTime`
 * or `ScheduledDeparture`); missing values may be inherited from the matching
 * base row before normalization.
 *
 * @param baseRows - Actual rows derived from hydrated boundary events
 * @param patches - Enriched patches with `TripKey`
 * @param updatedAt - `UpdatedAt` stamp for rows produced from patches
 * @returns Deduplicated final rows keyed by `EventKey`
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
