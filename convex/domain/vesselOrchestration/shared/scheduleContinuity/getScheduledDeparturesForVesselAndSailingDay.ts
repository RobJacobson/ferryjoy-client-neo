/**
 * Same-vessel scheduled departures for a sailing day, with a day guard for
 * trip-field inference.
 */

import type { CompactScheduledDepartureEvent } from "../scheduleSnapshot/scheduleSnapshotTypes";
import type { ScheduledSegmentTables } from "./types";

/**
 * Returns scheduled departures for one vessel when `sailingDay` matches the
 * tables’ day; otherwise `[]` so callers do not mix schedule evidence across
 * snapshot days.
 */
export const getScheduledDeparturesForVesselAndSailingDay = (
  tables: ScheduledSegmentTables,
  vesselAbbrev: string,
  sailingDay: string
): CompactScheduledDepartureEvent[] =>
  sailingDay !== tables.sailingDay
    ? []
    : [...(tables.scheduledDeparturesByVesselAbbrev[vesselAbbrev] ?? [])];
