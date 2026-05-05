/**
 * Plans eventsActual sparse upserts and full-day replacement reconciliation.
 *
 * These helpers keep table-specific rules testable without mixing them with
 * Convex reads and writes: last-row-wins dedupe, no-op equality skips, and
 * grandfathering ping-only rows during full-day reloads.
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

type ActualRowsForSailingDayReplacementPlan = {
  deletes: Id<"eventsActual">[];
  upsertRows: ConvexActualDockEvent[];
};

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
 * Plans a full-day actual row replacement without dropping ping-only rows.
 *
 * @param existingRows - Stored actual rows for the sailing day
 * @param finalRows - Hydrated candidate rows for the sailing day
 * @returns Delete IDs and deduped candidate rows to pass through sparse upsert
 */
const planActualRowsForSailingDayReplacement = (
  existingRows: Doc<"eventsActual">[],
  finalRows: ConvexActualDockEvent[]
): ActualRowsForSailingDayReplacementPlan => {
  const nextByEventKey = finalRowsByEventKey(finalRows);
  const surviveEventKeys = buildSurviveEventKeySet(
    nextByEventKey,
    existingRows
  );
  const deletes = existingRows
    .filter((row) => !surviveEventKeys.has(row.EventKey))
    .map((row) => row._id);

  return {
    deletes,
    upsertRows: [...nextByEventKey.values()],
  };
};

/**
 * Indexes a full hydrated day slice by EventKey for replace reconciliation.
 *
 * @param finalRows - Candidate rows from schedule hydration
 * @returns Map from EventKey to the winning candidate row
 */
const finalRowsByEventKey = (
  finalRows: ConvexActualDockEvent[]
): Map<string, ConvexActualDockEvent> =>
  new Map(finalRows.map((row) => [row.EventKey, row]));

/**
 * Builds the set of EventKeys that survive after the delete pass.
 *
 * @param nextByEventKey - Hydrated candidate rows keyed by EventKey
 * @param existingRows - Documents currently stored for this sailing day
 * @returns Keys to keep; rows not listed here are deleted before upserts run
 */
const buildSurviveEventKeySet = (
  nextByEventKey: Map<string, ConvexActualDockEvent>,
  existingRows: Doc<"eventsActual">[]
): Set<string> => {
  const survive = new Set(nextByEventKey.keys());

  for (const row of existingRows) {
    if (!nextByEventKey.has(row.EventKey) && row.ScheduleKey === undefined) {
      survive.add(row.EventKey);
    }
  }
  return survive;
};

export type { ActualDockRowUpsertPlan, ActualRowsForSailingDayReplacementPlan };
export {
  dedupeActualRowsByEventKey,
  planActualDockRowUpsert,
  planActualRowsForSailingDayReplacement,
};
