/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments (departure → stops → destination).
 * Shows scheduled times with actual/predicted times overlaid when real-time data is available.
 * Presentational only: requires displayState from parent and reads maps from ScheduledTripsMapsContext.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { TimelineSegmentLeg } from "../Timeline";
import { TIMELINE_CIRCLE_SIZE } from "../Timeline/config";
import { useScheduledTripsMapsContext } from "./ScheduledTripsMapsContext";
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
  timelineState: ScheduledTripTimelineState;
  inboundTripForFirstSegment?: VesselTrip;
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
  const maps = useScheduledTripsMapsContext();
  const vesselLocation = maps?.vesselLocationByAbbrev.get(
    displayState.vesselAbbrev
  );
  const vesselTripMap = maps?.vesselTripMap;
  const timeline = displayState.timeline;
  if (!vesselLocation || !vesselTripMap || !timeline || segments.length === 0) {
    return null;
  }
  return (
    <ScheduledTripTimelineContent
      segments={segments}
      vesselLocation={vesselLocation}
      vesselTripMap={vesselTripMap}
      timelineState={timeline}
      inboundTripForFirstSegment={displayState.inboundTripForFirstSegment}
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
  timelineState,
  inboundTripForFirstSegment,
}: ScheduledTripTimelineContentProps) => (
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
            : inboundTripForFirstSegment
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
