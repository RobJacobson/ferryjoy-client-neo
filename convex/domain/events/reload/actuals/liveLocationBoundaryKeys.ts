import type { DockEventType } from "functions/events/common/schemas";

const buildTripBoundaryKey = (tripKey: string, eventType: DockEventType) =>
  `${tripKey}|${eventType}`;

const buildTripBoundaryKeySet = (
  rows: ReadonlyArray<{ TripKey: string; EventType: DockEventType }>
): Set<string> =>
  new Set(rows.map((row) => buildTripBoundaryKey(row.TripKey, row.EventType)));

export { buildTripBoundaryKey, buildTripBoundaryKeySet };
