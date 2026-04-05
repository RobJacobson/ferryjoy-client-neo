/**
 * Shared schedule-backed dock resolution for live vessel identity.
 */

import type { ConvexInferredScheduledSegment } from "./schemas";

export type DockedScheduledSegmentSource =
  | "completed_trip_next"
  | "rollover_schedule"
  | "dock_interval";

export type ScheduledSegmentLookup = {
  getScheduledDepartureSegmentBySegmentKey: (
    segmentKey: string
  ) => Promise<ConvexInferredScheduledSegment | null>;
  getNextDepartureSegmentAfterDeparture: (args: {
    vesselAbbrev: string;
    departingTerminalAbbrev: string;
    previousScheduledDeparture: number;
  }) => Promise<ConvexInferredScheduledSegment | null>;
  getDockedDepartureSegmentForVesselAtTerminal: (args: {
    vesselAbbrev: string;
    departingTerminalAbbrev: string;
    observedAt: number;
  }) => Promise<ConvexInferredScheduledSegment | null>;
};

type ExistingTripContinuity = {
  NextKey?: string;
  ScheduledDeparture?: number;
} | null;

type ResolveDockedScheduledSegmentArgs = {
  vesselAbbrev: string;
  departingTerminalAbbrev: string;
  observedAt: number;
  existingTrip?: ExistingTripContinuity;
};

export type DockedScheduledSegmentResolution = {
  segment: ConvexInferredScheduledSegment;
  source: DockedScheduledSegmentSource;
};

/**
 * Resolve the scheduled departure segment that should own the current dock interval.
 *
 * The lookup order preserves trip continuity first and only falls back to pure
 * dock-interval ownership when no stronger prior-trip evidence exists.
 */
export const resolveDockedScheduledSegment = async (
  lookup: ScheduledSegmentLookup,
  args: ResolveDockedScheduledSegmentArgs
): Promise<DockedScheduledSegmentResolution | null> => {
  if (args.existingTrip?.NextKey) {
    const exactNextSegment =
      await lookup.getScheduledDepartureSegmentBySegmentKey(
        args.existingTrip.NextKey
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

  const dockIntervalSegment =
    await lookup.getDockedDepartureSegmentForVesselAtTerminal({
      vesselAbbrev: args.vesselAbbrev,
      departingTerminalAbbrev: args.departingTerminalAbbrev,
      observedAt: args.observedAt,
    });

  return dockIntervalSegment
    ? {
        segment: dockIntervalSegment,
        source: "dock_interval",
      }
    : null;
};
