/**
 * Plans eventsActual sparse upserts and full-day replacement reconciliation.
 *
 * These helpers keep table-specific rules testable without mixing them with
 * Convex reads and writes: last-row-wins dedupe and no-op equality skips.
 */

import type { Doc, Id } from "_generated/dataModel";
import { actualDockRowsEqual } from "functions/events/shared/actualDockRowsEqual";
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

export type { ActualDockRowUpsertPlan };
export { dedupeActualRowsByEventKey, planActualDockRowUpsert };
