/**
 * ScheduledTripTimeline component for displaying a sequence of scheduled trip segments.
 * Visualizes the journey from departure terminal to final destination, including intermediate stops.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { resolveTimeline, TimelineSegmentLeg } from "../Timeline";
import { TIMELINE_CIRCLE_SIZE } from "../Timeline/config";
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

  const resolution =
    journeyStatusOverride && journeyStatusOverride !== "InProgress"
      ? {
          activeKey: null,
          activeIndex: null,
          activePhase: "Unknown" as const,
          resolvedSegments: segments.map((s) => ({
            scheduled: s,
            actual: vesselTripMap.get(s.Key),
          })),
          statusByKey: new Map(
            segments.map((s) => [s.Key, journeyStatusOverride] as const)
          ),
        }
      : resolveTimeline({
          segments,
          vesselLocation,
          tripsByKey: vesselTripMap,
          nowMs: vesselLocation.TimeStamp.getTime(),
          heldTripKey: displayTrip?.Key,
          allowScheduleFallback: false,
        });

  return (
    <View className="relative flex-row items-center justify-between w-full overflow-visible px-4 py-8">
      {segments.map((segment, index) => (
        <TimelineSegmentLeg
          key={segment.Key}
          segment={segment}
          vesselLocation={vesselLocation}
          actualTrip={vesselTripMap.get(segment.Key)}
          prevActualTrip={
            index > 0 ? vesselTripMap.get(segments[index - 1].Key) : undefined
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
