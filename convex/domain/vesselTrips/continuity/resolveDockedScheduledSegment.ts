/**
 * Schedule-backed dock resolution for live vessel identity using trip continuity.
 *
 * Uses persisted next-leg hints (`NextScheduleKey` on vessel trips) and
 * same-terminal rollover after a known departure. Does not re-merge the full
 * timeline backbone on every tick; UI labels and structure come from
 * `eventsScheduled`.
 */

import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled/schemas";
import {
  findNextDepartureEvent,
  inferScheduledSegmentFromDepartureEvent,
} from "domain/timelineRows/scheduledSegmentResolvers";
import { getSailingDay } from "shared/time";

import type { DockedScheduledSegmentSource } from "./types";

export type ScheduledSegmentLookup = {
  getScheduledDepartureEventBySegmentKey: (
    segmentKey: string
  ) => Promise<ConvexScheduledDockEvent | null>;
  getScheduledDockEventsForSailingDay: (args: {
    vesselAbbrev: string;
    sailingDay: string;
  }) => Promise<ConvexScheduledDockEvent[]>;
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
 * Prefers exact next-leg schedule (`NextScheduleKey`) and same-day rollover
 * after a known departure; otherwise returns null so callers use raw feed
 * fields.
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
    const exactNextEvent = await lookup.getScheduledDepartureEventBySegmentKey(
      args.existingTrip.NextScheduleKey
    );

    if (exactNextEvent) {
      const sameDayEvents = await lookup.getScheduledDockEventsForSailingDay({
        vesselAbbrev: exactNextEvent.VesselAbbrev,
        sailingDay: exactNextEvent.SailingDay,
      });
      const exactNextSegment = inferScheduledSegmentFromDepartureEvent(
        exactNextEvent,
        sameDayEvents
      );

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

  if (args.existingTrip?.ScheduledDeparture !== undefined) {
    const sailingDay = getSailingDay(
      new Date(args.existingTrip.ScheduledDeparture)
    );
    const sameDayEvents = await lookup.getScheduledDockEventsForSailingDay({
      vesselAbbrev: args.vesselAbbrev,
      sailingDay,
    });
    const rolloverEvent = findNextDepartureEvent(sameDayEvents, {
      terminalAbbrev: args.departingTerminalAbbrev,
      afterTime: args.existingTrip.ScheduledDeparture,
    });

    if (rolloverEvent) {
      return {
        segment: inferScheduledSegmentFromDepartureEvent(
          rolloverEvent,
          sameDayEvents
        ),
        source: "rollover_schedule",
      };
    }
  }

  return null;
};
