/**
 * Projects WSF history evidence onto scheduled boundaries.
 *
 * WSF vessel history provides event timestamps separately from the schedule.
 * This module keeps that evidence outside scheduled boundaries, joins it to
 * trip identity, and emits actual rows for matched departure and arrival keys.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildActualDockEventFromWrite } from "../../actual";
import { definedRows } from "../shared";
import type { ReloadScheduledBoundary } from "../types";

/**
 * Projects WSF history actual evidence into actual dock rows.
 *
 * History evidence is indexed by scheduled boundary key before this function
 * runs. The projection only emits rows whose scheduled segment can be joined
 * to a known TripKey, keeping scheduled boundaries pure while still letting
 * durable WSF history timestamps anchor the reload actual set.
 *
 * @param boundaries - Scheduled boundary records for the reload day
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @param historyActualsByEventKey - History actual times indexed by boundary key
 * @returns Validator-shaped actual dock rows for boundaries with actuals
 */
const buildHistoryActualRows = (
  boundaries: ReloadScheduledBoundary[],
  updatedAt: number,
  tripKeyBySegmentKey: Map<string, string>,
  historyActualsByEventKey: Map<string, number>
): ConvexActualDockEvent[] => {
  const actualDockRowOrUndefinedByBoundary = boundaries.map((boundary) => {
    const tripKey = tripKeyBySegmentKey.get(boundary.SegmentKey);
    const eventActualTime = historyActualsByEventKey.get(boundary.Key);

    if (tripKey === undefined || eventActualTime === undefined) {
      return undefined;
    }

    const actualDockRowFromSeededBoundary = buildActualDockEventFromWrite(
      {
        TripKey: tripKey,
        VesselAbbrev: boundary.VesselAbbrev,
        SailingDay: boundary.SailingDay,
        ScheduledDeparture: boundary.ScheduledDeparture,
        TerminalAbbrev: boundary.TerminalAbbrev,
        EventType: boundary.EventType,
        EventOccurred: true,
        EventActualTime: eventActualTime,
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
