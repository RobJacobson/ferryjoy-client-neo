/**
 * Dedupes actual dock rows by EventKey, keeping the last occurrence per key.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";

const dedupeActualRowsByEventKey = (
  rows: ConvexActualDockEvent[]
): ConvexActualDockEvent[] => [
  ...new Map(rows.map((row) => [row.EventKey, row])).values(),
];

export { dedupeActualRowsByEventKey };
