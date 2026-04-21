/**
 * Schedule-backed dock resolution for live vessel identity using trip continuity.
 *
 * Uses persisted next-leg hints (`NextScheduleKey` on vessel trips) and
 * same-terminal rollover after a known departure. Does not re-merge the full
 * timeline backbone on every ping; UI labels and structure come from
 * `eventsScheduled`.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import {
  type DockedScheduledSegmentSource,
  getScheduledDeparturesForVesselAndSailingDay,
  type ScheduledSegmentTables,
} from "domain/vesselOrchestration/shared";
import { getSailingDay } from "shared/time";

type ExistingTripContinuity = {
  NextScheduleKey?: string;
  ScheduledDeparture?: number;
} | null;

type ResolveDockedScheduledSegmentArgs = {
  vesselAbbrev: string;
  departingTerminalAbbrev: string;
  existingTrip?: ExistingTripContinuity;
};

export type DockedScheduledSegmentResolution = {
  segment: ConvexInferredScheduledSegment;
  source: DockedScheduledSegmentSource;
};

/**
 * Resolve the scheduled departure segment that should own the current dock
 * interval when the live feed omits trip identity.
 *
 * Prefers exact next-leg schedule (`NextScheduleKey`) and same-day rollover
 * after a known departure; otherwise returns null so callers use raw feed
 * fields.
 *
 * @param tables - Schedule rows (in-memory snapshot or test double)
 * @param args - Vessel, terminal, and optional prior-trip hints
 * @returns Segment plus provenance, or null when no continuity match exists
 */
export const resolveDockedScheduledSegment = (
  tables: ScheduledSegmentTables,
  args: ResolveDockedScheduledSegmentArgs
): DockedScheduledSegmentResolution | null => {
  // 1) Exact next leg from the prior row when the terminal still matches.
  if (args.existingTrip?.NextScheduleKey) {
    const exactNextSegment =
      tables.scheduledDepartureBySegmentKey[args.existingTrip.NextScheduleKey];

    if (exactNextSegment) {
      if (
        exactNextSegment.DepartingTerminalAbbrev ===
        args.departingTerminalAbbrev
      ) {
        return {
          segment: exactNextSegment,
          source: "completed_trip_next",
        };
      }
    }
  }

  // 2) Same-day rollover: next departure after a known scheduled time at port.
  if (args.existingTrip?.ScheduledDeparture !== undefined) {
    const sailingDay = getSailingDay(
      new Date(args.existingTrip.ScheduledDeparture)
    );
    const sameDayDepartures = getScheduledDeparturesForVesselAndSailingDay(
      tables,
      args.vesselAbbrev,
      sailingDay
    );
    const rolloverDeparture =
      sameDayDepartures.find(
        (event) =>
          event.TerminalAbbrev === args.departingTerminalAbbrev &&
          event.ScheduledDeparture > args.existingTrip!.ScheduledDeparture!
      ) ?? null;

    if (rolloverDeparture) {
      const rolloverSegment =
        tables.scheduledDepartureBySegmentKey[
          getSegmentKeyFromBoundaryKey(rolloverDeparture.Key)
        ];

      if (!rolloverSegment) {
        return null;
      }

      return {
        segment: rolloverSegment,
        source: "rollover_schedule",
      };
    }
  }

  return null;
};
