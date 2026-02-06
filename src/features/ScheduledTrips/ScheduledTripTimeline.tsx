/**
 * ScheduledTripTimeline component for displaying a sequence of scheduled trip segments.
 * Visualizes the journey from departure terminal to final destination, including intermediate stops.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { resolveTimeline, TimelineSegmentLeg } from "../Timeline";
import { TIMELINE_CIRCLE_SIZE } from "../Timeline/config";
import type { ScheduledTripTimelineResolution } from "./resolveScheduledTripsPageResolution";
import type { Segment } from "./types";
import { useScheduledTripDisplayData } from "./useScheduledTripDisplayData";

type ScheduledTripTimelineProps = {
  /**
   * Vessel abbreviation for the trip.
   */
  vesselAbbrev: string;
  /**
   * Array of segments forming the complete journey.
   */
  segments: Segment[];
  /**
   * Optional override: resolved vessel location for this vessel (already synchronized for hold).
   * When provided, ScheduledTripTimeline becomes purely presentational and does not fetch.
   */
  vesselLocationOverride?: VesselLocation;
  /**
   * Optional override: active/held trip for this vessel (used to lock activeKey during hold).
   */
  displayTripOverride?: VesselTrip;
  /**
   * Optional override: unified trip map (completed + active + held).
   */
  vesselTripMapOverride?: Map<string, VesselTrip>;
  /**
   * Optional override: journey-level status for page-wide monotonic ordering.
   * When set to Completed/Pending, no segment-level active inference is performed.
   */
  journeyStatusOverride?: "Pending" | "InProgress" | "Completed";
  /**
   * Optional override: fully resolved timeline state (active key/phase + per-segment statuses).
   * When provided, ScheduledTripTimeline becomes a pure renderer and does not run resolution logic.
   */
  timelineOverride?: ScheduledTripTimelineResolution;
};

/**
 * Displays a multi-segment timeline for scheduled ferry trips.
 * Shows scheduled departure times and arrival times, with actual times overlaid if a matching
 * active or recently completed trip is found.
 *
 * VesselLocation is PRIMARY source for all vessel state data.
 * VesselTrip and ScheduledTrips are SECONDARY lookups for predictions and schedule info.
 *
 * @param vesselAbbrev - Vessel abbreviation for the trip
 * @param segments - Array of trip segments to display
 * @returns A View component with a sequence of markers and progress bars
 */
export const ScheduledTripTimeline = ({
  vesselAbbrev,
  segments,
  vesselLocationOverride,
  displayTripOverride,
  vesselTripMapOverride,
  journeyStatusOverride,
  timelineOverride,
}: ScheduledTripTimelineProps) => {
  const sailingDay = segments[0]?.SailingDay;
  const departingTerminalAbbrevs = [
    ...new Set(segments.map((s) => s.DepartingTerminalAbbrev)),
  ];

  const shouldFetch = !vesselLocationOverride || !vesselTripMapOverride;
  const fetched = useScheduledTripDisplayData({
    vesselAbbrev,
    sailingDay: shouldFetch ? sailingDay : undefined,
    departingTerminalAbbrevs: shouldFetch ? departingTerminalAbbrevs : [],
  });

  const vesselLocation = vesselLocationOverride ?? fetched.vesselLocation;
  const displayTrip = displayTripOverride ?? fetched.displayTrip;
  const vesselTripMap = vesselTripMapOverride ?? fetched.vesselTripMap;

  if (!vesselLocation || !vesselTripMap || segments.length === 0) return null;

  // For future cards, we still want to show "arrive-next" and "depart-next" predictions
  // even when the future segment does not yet have its own VesselTrip record.
  //
  // Those predictions live on the *current* (inbound) VesselTrip. We attach them
  // deterministically using the scheduled chain pointer:
  // - `displayTrip.ScheduledTrip.NextKey` is the Key of the *next scheduled trip* that
  //   the inbound trip is predicting (arrive-next/depart-next).
  //
  // This is strict key matching, not time-window inference. It prevents the bug where
  // morning/late-night trips accidentally show predictions for the current evening run.
  const inboundTripForFirstSegmentIfMatching = (() => {
    const firstSegment = segments[0];
    if (!firstSegment) return undefined;
    if (!displayTrip) return undefined;

    // Only borrow predictions from an inbound trip that is arriving at this segment's
    // departing terminal.
    if (
      displayTrip.ArrivingTerminalAbbrev !==
      firstSegment.DepartingTerminalAbbrev
    ) {
      return undefined;
    }

    const nextKey = displayTrip.ScheduledTrip?.NextKey;
    if (!nextKey) return undefined;

    return nextKey === firstSegment.Key ? displayTrip : undefined;
  })();

  const resolution = timelineOverride
    ? timelineOverride
    : journeyStatusOverride && journeyStatusOverride !== "InProgress"
      ? {
          activeKey: null,
          activeConfidence: "None" as const,
          activePhase: "Unknown" as const,
          statusByKey: new Map(
            segments.map((s) => [s.Key, journeyStatusOverride] as const)
          ),
        }
      : (() => {
          const r = resolveTimeline({
            segments,
            vesselLocation,
            tripsByKey: vesselTripMap,
            nowMs: vesselLocation.TimeStamp.getTime(),
            heldTripKey: displayTrip?.Key,
            allowScheduleFallback: false,
          });

          return {
            activeKey: r.activeKey,
            activeConfidence: "None" as const,
            activePhase: r.activePhase,
            statusByKey: r.statusByKey,
          };
        })();

  return (
    <View className="relative flex-row items-center justify-between w-full overflow-visible px-4 py-8">
      {segments.map((segment, index) => (
        <TimelineSegmentLeg
          key={segment.Key}
          segment={segment}
          vesselLocation={vesselLocation}
          actualTrip={vesselTripMap.get(segment.Key)}
          prevActualTrip={
            index > 0
              ? vesselTripMap.get(segments[index - 1].Key)
              : inboundTripForFirstSegmentIfMatching
          }
          nextActualTrip={
            index < segments.length - 1
              ? vesselTripMap.get(segments[index + 1].Key)
              : undefined
          }
          circleSize={TIMELINE_CIRCLE_SIZE}
          isFirst={index === 0}
          isLast={index === segments.length - 1}
          skipAtDock={false}
          legStatus={resolution.statusByKey.get(segment.Key) ?? "Pending"}
          activeKey={resolution.activeKey}
          activePhase={resolution.activePhase}
        />
      ))}
    </View>
  );
};
