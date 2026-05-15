/**
 * Projects reload boundary records into scheduled dock rows.
 *
 * Boundary construction already resolves direct per-segment terminal metadata.
 * This module keeps projection small: copy the boundary shape into the table
 * row shape and mark the final arrival independently for each vessel day.
 */

import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { DockStatusEventRecord } from "../types";

/**
 * Projects hydrated boundary records into Convex scheduled dock rows.
 *
 * Reload writes scheduled rows as a full sailing-day replacement, but final
 * arrival is a vessel-day concept. This projection computes those keys from
 * the supplied boundary order and avoids rebuilding terminal lookups that the
 * boundary stage already resolved from the direct seed segment.
 *
 * @param events - Hydrated boundary records grouped by vessel day
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @returns Validator-shaped scheduled dock rows
 */
const buildScheduledRows = (
  events: DockStatusEventRecord[],
  updatedAt: number
): ConvexScheduledDockEvent[] => {
  const lastArrivalKeys = findLastArrivalKeysByVesselDay(events);

  return events.map((event) => ({
    Key: event.Key,
    VesselAbbrev: event.VesselAbbrev,
    SailingDay: event.SailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: event.ScheduledDeparture,
    TerminalAbbrev: event.TerminalAbbrev,
    NextTerminalAbbrev: event.NextTerminalAbbrev,
    EventType: event.EventType,
    EventScheduledTime: event.EventScheduledTime,
    IsLastArrivalOfSailingDay:
      event.EventType === "arv-dock" && lastArrivalKeys.has(event.Key),
  }));
};

/**
 * Finds the final arrival boundary for every vessel and sailing day.
 *
 * @param events - Hydrated boundary records grouped by vessel day
 * @returns Set of arrival boundary keys that close their vessel sailing day
 */
const findLastArrivalKeysByVesselDay = (
  events: DockStatusEventRecord[]
): Set<string> => {
  const lastArrivalKeyByVesselDay = new Map<string, string>();

  for (const event of events) {
    if (event.EventType === "arv-dock") {
      lastArrivalKeyByVesselDay.set(toVesselDayKey(event), event.Key);
    }
  }

  return new Set(lastArrivalKeyByVesselDay.values());
};

/**
 * Builds the grouping key for a boundary event vessel and sailing day.
 *
 * @param event - Boundary event carrying vessel and sailing day
 * @returns Composite vessel-day key
 */
const toVesselDayKey = (
  event: Pick<DockStatusEventRecord, "VesselAbbrev" | "SailingDay">
) => `${event.VesselAbbrev}:${event.SailingDay}`;

export { buildScheduledRows };
