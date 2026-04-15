/**
 * Schedule-backed dock resolution for live vessel identity using trip continuity.
 *
 * Uses persisted next-leg hints (`NextScheduleKey` on vessel trips) and
 * same-terminal rollover after a
 * known departure. Deliberately does not re-merge the full timeline backbone on
 * every tick; UI labels and structure already come from `eventsScheduled`.
 */

import type { ConvexInferredScheduledSegment } from "./schemas";

export type DockedScheduledSegmentSource =
  | "completed_trip_next"
  | "rollover_schedule";

export type ScheduledSegmentLookup = {
  getScheduledDepartureSegmentBySegmentKey: (
    segmentKey: string
  ) => Promise<ConvexInferredScheduledSegment | null>;
  getNextDepartureSegmentAfterDeparture: (args: {
    vesselAbbrev: string;
    departingTerminalAbbrev: string;
    previousScheduledDeparture: number;
  }) => Promise<ConvexInferredScheduledSegment | null>;
};

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
 * Prefers exact next-leg schedule (`NextScheduleKey`) and same-day rollover after a
 * known departure; otherwise returns null so callers use raw feed fields.
 *
 * @param lookup - Internal schedule query adapters
 * @param args - Vessel, terminal, and optional prior-trip hints
 * @returns Segment plus provenance, or null when no continuity match exists
 */
export const resolveDockedScheduledSegment = async (
  lookup: ScheduledSegmentLookup,
  args: ResolveDockedScheduledSegmentArgs
): Promise<DockedScheduledSegmentResolution | null> => {
  if (args.existingTrip?.NextScheduleKey) {
    const exactNextSegment =
      await lookup.getScheduledDepartureSegmentBySegmentKey(
        args.existingTrip.NextScheduleKey
      );

    if (
      exactNextSegment &&
      exactNextSegment.DepartingTerminalAbbrev === args.departingTerminalAbbrev
    ) {
      return {
        segment: exactNextSegment,
        source: "completed_trip_next",
      };
    }
  }

  if (args.existingTrip?.ScheduledDeparture !== undefined) {
    const rolloverSegment = await lookup.getNextDepartureSegmentAfterDeparture({
      vesselAbbrev: args.vesselAbbrev,
      departingTerminalAbbrev: args.departingTerminalAbbrev,
      previousScheduledDeparture: args.existingTrip.ScheduledDeparture,
    });

    if (rolloverSegment) {
      return {
        segment: rolloverSegment,
        source: "rollover_schedule",
      };
    }
  }

  return null;
};
