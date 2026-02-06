/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments (departure → stops → destination).
 * Shows scheduled times with actual/predicted times overlaid when real-time data is available.
 * Presentational only: requires displayState from parent (no data fetching).
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { TimelineSegmentLeg } from "../Timeline";
import { TIMELINE_CIRCLE_SIZE } from "../Timeline/config";
import type { Segment } from "./types";
import type {
  ScheduledTripCardDisplayState,
  ScheduledTripTimelineState,
} from "./utils/computePageDisplayState";

// ============================================================================
// Types
// ============================================================================

type ScheduledTripTimelineProps = {
  /**
   * Array of segments forming the complete journey.
   */
  segments: Segment[];
  /**
   * Pre-computed display state from the list page. Required; timeline does not fetch data.
   */
  displayState: ScheduledTripCardDisplayState;
};

type ScheduledTripTimelineContentProps = {
  segments: Segment[];
  vesselLocation: VesselLocation;
  vesselTripMap: Map<string, VesselTrip>;
  displayTrip: VesselTrip | undefined;
  timelineState: ScheduledTripTimelineState;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Displays a multi-segment timeline for scheduled ferry trips.
 * Presentational only: requires displayState from parent (e.g. from ScheduledTripList).
 *
 * @param segments - Array of trip segments to display
 * @param displayState - Pre-computed card display state (required)
 * @returns A View component with a sequence of markers and progress bars, or null
 */
export const ScheduledTripTimeline = ({
  segments,
  displayState,
}: ScheduledTripTimelineProps) => {
  const vesselLocation = displayState.vesselLocation;
  const vesselTripMap = displayState.vesselTripMap;
  const timeline = displayState.timeline;
  if (!vesselLocation || !vesselTripMap || !timeline || segments.length === 0) {
    return null;
  }
  return (
    <ScheduledTripTimelineContent
      segments={segments}
      vesselLocation={vesselLocation}
      vesselTripMap={vesselTripMap}
      displayTrip={displayState.displayTrip}
      timelineState={timeline}
    />
  );
};

// ============================================================================
// Presentational content (no hooks, no display-state logic)
// ============================================================================

/**
 * Renders timeline legs from pre-computed data.
 *
 * @param segments - Ordered segments for this journey
 * @param vesselLocation - Resolved vessel location
 * @param vesselTripMap - Map of segment Key to VesselTrip
 * @param displayTrip - Held/active trip for this vessel
 * @param timelineState - Pre-computed active key, phase, and status per segment
 */
const ScheduledTripTimelineContent = ({
  segments,
  vesselLocation,
  vesselTripMap,
  displayTrip,
  timelineState,
}: ScheduledTripTimelineContentProps) => {
  // For future cards, attach "arrive-next" and "depart-next" predictions from
  // the current inbound VesselTrip when displayTrip.ScheduledTrip.NextKey matches
  // the first segment's Key (strict key matching to avoid prediction leakage).
  const inboundTripForFirstSegmentIfMatching = (() => {
    const firstSegment = segments[0];
    if (!firstSegment || !displayTrip) return undefined;
    if (
      displayTrip.ArrivingTerminalAbbrev !==
      firstSegment.DepartingTerminalAbbrev
    ) {
      return undefined;
    }
    const nextKey = displayTrip.ScheduledTrip?.NextKey;
    if (!nextKey || nextKey !== firstSegment.Key) return undefined;
    return displayTrip;
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
          legStatus={timelineState.statusByKey.get(segment.Key) ?? "Pending"}
          activeKey={timelineState.activeKey}
          activePhase={timelineState.activePhase}
        />
      ))}
    </View>
  );
};
