/**
 * Projects history-hydrated boundary events into actual dock rows.
 *
 * Boundary records carrying EventOccurred or EventActualTime represent observed
 * dock events sourced from WSF vessel history; this module joins them against
 * the trip-key index and emits the eventsActual rows that anchor the day.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildActualDockEventFromWrite } from "../../actual";
import { definedRows } from "../collectionHelpers";
import type { DockStatusEventRecord } from "../types";

/**
 * Projects hydrated boundary records with actual evidence into actual rows.
 *
 * Filters boundaries to those carrying observation evidence (either occurred
 * marker or actual time) and joins them to TripKeys via the segment index so
 * each emitted row links to a known trip. Boundaries without evidence or
 * without a TripKey match are skipped so the actuals set stays clean.
 *
 * @param events - Hydrated boundary records
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @returns Validator-shaped actual dock rows for boundaries with actuals
 */
const buildHistoryActualRows = (
  events: DockStatusEventRecord[],
  updatedAt: number,
  tripKeyBySegmentKey: Map<string, string>
): ConvexActualDockEvent[] => {
  const actualDockRowOrUndefinedByBoundary = events.map((event) => {
    const tripKey = tripKeyBySegmentKey.get(event.SegmentKey);

    if (
      tripKey === undefined ||
      (event.EventOccurred !== true && event.EventActualTime === undefined)
    ) {
      return undefined;
    }

    const actualDockRowFromSeededBoundary = buildActualDockEventFromWrite(
      {
        TripKey: tripKey,
        VesselAbbrev: event.VesselAbbrev,
        SailingDay: event.SailingDay,
        ScheduledDeparture: event.ScheduledDeparture,
        TerminalAbbrev: event.TerminalAbbrev,
        EventType: event.EventType,
        EventOccurred: true,
        EventActualTime: event.EventActualTime,
      },
      updatedAt
    );

    return actualDockRowFromSeededBoundary;
  });
  const actualDockRowsFromHistoryHydration = definedRows(
    actualDockRowOrUndefinedByBoundary
  );

  return actualDockRowsFromHistoryHydration;
};

export { buildHistoryActualRows };
