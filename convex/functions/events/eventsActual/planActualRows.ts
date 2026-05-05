/**
 * Plans eventsActual sparse upserts and full-day replacement reconciliation.
 *
 * These helpers keep table-specific rules testable without mixing them with
 * Convex reads and writes: last-row-wins dedupe and no-op equality skips.
 */

import type { Doc, Id } from "_generated/dataModel";
import type { ConvexActualDockEvent } from "./schemas";

type ActualDockRowUpsertPlan =
  | { operation: "insert"; row: ConvexActualDockEvent }
  | {
      operation: "replace";
      existingId: Id<"eventsActual">;
      row: ConvexActualDockEvent;
    }
  | { operation: "skip" };

/**
 * Deduplicates actual dock rows by physical EventKey, keeping the last copy.
 *
 * @param rows - Sparse batch from trip event projection or hydrated reload
 * @returns One row per distinct EventKey after collapse
 */
const dedupeActualRowsByEventKey = (
  rows: ConvexActualDockEvent[]
): ConvexActualDockEvent[] =>
  Array.from(
    rows
      .reduce(
        (map, row) => map.set(row.EventKey, row),
        new Map<string, ConvexActualDockEvent>()
      )
      .values()
  );

/**
 * Plans the write operation for one sparse actual row.
 *
 * @param existing - Stored row for the EventKey, when present
 * @param row - Candidate row for the EventKey
 * @returns Insert, replace, or skip operation for the mutation to apply
 */
const planActualDockRowUpsert = (
  existing: Doc<"eventsActual"> | null | undefined,
  row: ConvexActualDockEvent
): ActualDockRowUpsertPlan => {
  if (!existing) {
    return { operation: "insert", row };
  }

  return actualDockRowsEqual(existing, row)
    ? { operation: "skip" }
    : { operation: "replace", existingId: existing._id, row };
};

/**
 * Compares stored documents with incoming payloads for semantic equality.
 *
 * Convex adds system fields that must not force replaces; this compares only the
 * payload columns clients observe. EventOccurred is treated as equivalent to having
 * EventActualTime so sparse pings that toggle only the literal flag still compare equal.
 *
 * @param left - Stored eventsActual document including Convex metadata
 * @param right - Candidate row being applied (includes fresh UpdatedAt)
 * @returns True when upsertActualDockRows should skip replace for this EventKey
 */
const actualDockRowsEqual = (
  left: Doc<"eventsActual">,
  right: ConvexActualDockEvent
): boolean =>
  left.EventKey === right.EventKey &&
  left.TripKey === right.TripKey &&
  left.EventType === right.EventType &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  (left.EventOccurred ?? left.EventActualTime !== undefined) ===
    (right.EventOccurred ?? right.EventActualTime !== undefined) &&
  left.EventActualTime === right.EventActualTime;

export type { ActualDockRowUpsertPlan };
export { dedupeActualRowsByEventKey, planActualDockRowUpsert };
