/**
 * Same-vessel scheduled boundary rows for a sailing day, with a day guard.
 */

import type { ConvexScheduledDockEvent } from "domain/events/scheduled/schemas";

import type { ScheduledSegmentTables } from "./types";

/**
 * Returns scheduled dock boundary events for one vessel when `sailingDay`
 * matches the tables’ day; otherwise `[]` so callers do not mix snapshot days.
 */
export const getScheduledDockEventsForVesselAndSailingDay = (
  tables: ScheduledSegmentTables,
  vesselAbbrev: string,
  sailingDay: string
): ConvexScheduledDockEvent[] =>
  sailingDay !== tables.sailingDay
    ? []
    : [...(tables.scheduledDockEventsByVesselAbbrev[vesselAbbrev] ?? [])];
