/**
 * Same-vessel scheduled departures for a sailing day, with a day guard for
 * trip-field inference.
 */

import type { CompactScheduledDepartureEvent } from "../scheduleSnapshot/scheduleSnapshotTypes";
import type { ScheduleContinuityAccess } from "./types";

/**
 * Returns scheduled departures for one vessel when `sailingDay` matches the
 * tables’ day; otherwise `[]` so callers do not mix schedule evidence across
 * snapshot days.
 */
export const getScheduledDeparturesForVesselAndSailingDay = (
  scheduleAccess: ScheduleContinuityAccess,
  vesselAbbrev: string,
  sailingDay: string
): Promise<ReadonlyArray<CompactScheduledDepartureEvent>> =>
  scheduleAccess.getScheduledDeparturesForVesselAndSailingDay(
    vesselAbbrev,
    sailingDay
  );
