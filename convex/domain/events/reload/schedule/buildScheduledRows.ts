/**
 * Projects boundary event records into validator-shaped scheduled dock rows.
 *
 * Reload writes the scheduled set once per sailing day; this module turns the
 * shared boundary tape into the Convex row shape expected by the eventsScheduled
 * table, including the per-segment next-terminal back-reference and the marker
 * flag for the final arrival of the day.
 */

import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { DockStatusEventRecord } from "../types";

/**
 * Projects hydrated boundary records into Convex scheduled dock rows.
 *
 * Walks the boundary tape once to compute the arrival-terminal back-reference
 * each departure row needs, finds the final arrival of the day for the
 * IsLastArrivalOfSailingDay marker, and emits one Convex row per boundary so
 * the scheduled-table mutation has a deterministic input to upsert.
 *
 * @param events - Hydrated boundary records sorted in timeline order
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @returns Validator-shaped scheduled dock rows
 */
const buildScheduledRows = (
  events: DockStatusEventRecord[],
  updatedAt: number
): ConvexScheduledDockEvent[] => {
  const arrivalTerminalBySegmentKey = new Map(
    events
      .filter((event) => event.EventType === "arv-dock")
      .map((event) => [event.SegmentKey, event.TerminalAbbrev])
  );
  const lastArrivalKey =
    [...events].reverse().find((event) => event.EventType === "arv-dock")
      ?.Key ?? null;

  const scheduledDockRowsForDay = events.map((event) => ({
    Key: event.Key,
    VesselAbbrev: event.VesselAbbrev,
    SailingDay: event.SailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: event.ScheduledDeparture,
    TerminalAbbrev: event.TerminalAbbrev,
    NextTerminalAbbrev:
      event.EventType === "arv-dock"
        ? event.TerminalAbbrev
        : (arrivalTerminalBySegmentKey.get(event.SegmentKey) ??
          event.TerminalAbbrev),
    EventType: event.EventType,
    EventScheduledTime: event.EventScheduledTime,
    IsLastArrivalOfSailingDay:
      event.EventType === "arv-dock" && event.Key === lastArrivalKey,
  }));

  return scheduledDockRowsForDay;
};

export { buildScheduledRows };
