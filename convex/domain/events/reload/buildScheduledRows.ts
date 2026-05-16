/**
 * Project scheduled boundaries into scheduled dock-event rows.
 *
 * Boundary construction owns vessel-day ordering and scheduled boundary times;
 * this module only maps those boundaries into the table row shape and marks the
 * final arrival for each vessel day.
 */

import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ScheduledBoundary } from "./types";

/**
 * Projects scheduled boundaries into eventsScheduled rows.
 *
 * @param boundaries - Scheduled boundaries for the sailing day
 * @param updatedAt - UpdatedAt timestamp for produced rows
 * @returns Scheduled dock-event rows ready for persistence
 */
const buildScheduledRows = (
  boundaries: ScheduledBoundary[],
  updatedAt: number
): ConvexScheduledDockEvent[] => {
  const lastArrivalKeys = findLastArrivalKeysByVesselDay(boundaries);
  const scheduledRows = boundaries.map((boundary) => ({
    Key: boundary.Key,
    VesselAbbrev: boundary.VesselAbbrev,
    SailingDay: boundary.SailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: boundary.ScheduledDeparture,
    TerminalAbbrev: boundary.TerminalAbbrev,
    NextTerminalAbbrev: boundary.NextTerminalAbbrev,
    EventType: boundary.EventType,
    EventScheduledTime: boundary.EventScheduledTime,
    IsLastArrivalOfSailingDay:
      boundary.EventType === "arv-dock" && lastArrivalKeys.has(boundary.Key),
  }));

  return scheduledRows;
};

/**
 * Finds the final arrival boundary per vessel day.
 *
 * @param boundaries - Scheduled boundaries for the sailing day
 * @returns Boundary keys that close their vessel day
 */
const findLastArrivalKeysByVesselDay = (
  boundaries: ScheduledBoundary[]
): Set<string> =>
  new Set([
    ...boundaries
      .filter((boundary) => boundary.EventType === "arv-dock")
      .reduce(
        (keysByVesselDay, boundary) =>
          new Map(keysByVesselDay).set(toVesselDayKey(boundary), boundary.Key),
        new Map<string, string>()
      )
      .values(),
  ]);

/**
 * Builds the composite vessel-day key.
 *
 * @param boundary - Scheduled boundary with vessel and sailing day
 * @returns Composite vessel-day key
 */
const toVesselDayKey = (
  boundary: Pick<ScheduledBoundary, "VesselAbbrev" | "SailingDay">
) => `${boundary.VesselAbbrev}:${boundary.SailingDay}`;

export { buildScheduledRows };
