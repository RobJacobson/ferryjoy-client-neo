/**
 * Merges sparse `ConvexActualBoundaryPatch` payloads into base `eventsActual`
 * row shapes for same-day replace flows (hydration + live-location deltas).
 */

import type { Infer } from "convex/values";
import { buildActualBoundaryEventFromPatch } from "domain/vesselTimeline/normalizedEvents";
import type {
  actualBoundaryPatchSchema,
  ConvexActualBoundaryEvent,
} from "../eventsActual/schemas";

/**
 * Merges sparse actual-boundary patches into base rows: each patch becomes a
 * candidate row; `EventOccurred` is always true; a known `EventActualTime` on
 * the base row is preserved when the patch omits one; a patch's
 * `EventActualTime` wins when present. Later patches with the same `Key`
 * overwrite earlier ones.
 *
 * @param baseRows - Actual rows derived from hydrated boundary events
 * @param patches - Same shape as trip-driven projection (segment + type)
 * @param updatedAt - `UpdatedAt` stamp for rows produced from patches
 * @returns Deduplicated final rows keyed by `Key`
 */
export const mergeActualBoundaryPatchesIntoRows = (
  baseRows: ConvexActualBoundaryEvent[],
  patches: Array<Infer<typeof actualBoundaryPatchSchema>>,
  updatedAt: number
): ConvexActualBoundaryEvent[] => {
  const byKey = new Map(baseRows.map((row) => [row.Key, row]));

  for (const patch of patches) {
    const candidate = buildActualBoundaryEventFromPatch(patch, updatedAt);
    const existing = byKey.get(candidate.Key);
    byKey.set(candidate.Key, {
      ...candidate,
      EventOccurred: true,
      EventActualTime: candidate.EventActualTime ?? existing?.EventActualTime,
    });
  }

  return [...byKey.values()];
};
