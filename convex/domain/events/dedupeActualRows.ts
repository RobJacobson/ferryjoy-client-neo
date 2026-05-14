/**
 * Dedupes actual dock rows by EventKey for reload and upsert pipelines.
 *
 * Several actual-event sources can emit a row for the same physical boundary,
 * and eventsActual upserts assume each EventKey appears at most once per call.
 * Keeping this helper outside reload makes that shared persistence contract
 * explicit.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";

/**
 * Collapses actual dock rows by EventKey, keeping the last occurrence.
 *
 * Reload and orchestration paths often emit a row from multiple sources for
 * the same physical boundary; this collapses them to a single row per
 * EventKey, preferring later entries so caller-provided source ordering
 * controls which row survives. Pure and side-effect-free.
 *
 * @param rows - Actual dock rows from one reload or update pipeline
 * @returns Unique rows by EventKey in original insertion order
 */
const dedupeActualRowsByEventKey = (
  rows: ConvexActualDockEvent[]
): ConvexActualDockEvent[] => [
  ...new Map(rows.map((row) => [row.EventKey, row])).values(),
];

export { dedupeActualRowsByEventKey };
