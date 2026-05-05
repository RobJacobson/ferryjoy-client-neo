/**
 * Plans eventsScheduled row reconciliation for one sailing day.
 *
 * The mutation layer owns database reads and writes; this module owns the
 * table-local comparison and delete/insert/replace decisions.
 */

import type { Doc, Id } from "_generated/dataModel";
import type { ConvexScheduledDockEvent } from "./schemas";

type ScheduledRowReplacement = {
  existingId: Id<"eventsScheduled">;
  row: ConvexScheduledDockEvent;
};

type ScheduledRowsForSailingDayPlan = {
  deletes: Id<"eventsScheduled">[];
  inserts: ConvexScheduledDockEvent[];
  replacements: ScheduledRowReplacement[];
};

/**
 * Computes the write plan for replacing one scheduled sailing-day slice.
 *
 * @param existingRows - Stored scheduled rows already loaded for the sailing day
 * @param nextRows - Complete replacement rows for the sailing day
 * @returns Delete, insert, and replacement operations for the mutation to apply
 */
const planScheduledRowsForSailingDay = (
  existingRows: Doc<"eventsScheduled">[],
  nextRows: ConvexScheduledDockEvent[]
): ScheduledRowsForSailingDayPlan => {
  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));
  const nextKeys = new Set(nextRows.map((row) => row.Key));

  const deletes = existingRows
    .filter((existing) => !nextKeys.has(existing.Key))
    .map((existing) => existing._id);
  const inserts: ConvexScheduledDockEvent[] = [];
  const replacements: ScheduledRowReplacement[] = [];

  for (const nextRow of nextRows) {
    const existing = existingByKey.get(nextRow.Key);

    if (!existing) {
      inserts.push(nextRow);
      continue;
    }

    if (!scheduledRowsEqual(existing, nextRow)) {
      replacements.push({ existingId: existing._id, row: nextRow });
    }
  }

  return { deletes, inserts, replacements };
};

/**
 * Compares stored scheduled rows with hydrated candidates for semantic drift.
 *
 * @param left - Stored eventsScheduled document from the database
 * @param right - Candidate row produced by buildScheduledDockEvents
 * @returns True when no visible column differs between left and right
 */
const scheduledRowsEqual = (
  left: Doc<"eventsScheduled">,
  right: ConvexScheduledDockEvent
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.NextTerminalAbbrev === right.NextTerminalAbbrev &&
  left.EventType === right.EventType &&
  left.EventScheduledTime === right.EventScheduledTime &&
  (left.IsLastArrivalOfSailingDay ?? false) ===
    (right.IsLastArrivalOfSailingDay ?? false);

export type { ScheduledRowsForSailingDayPlan };
export { planScheduledRowsForSailingDay };
