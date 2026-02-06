/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments (departure → stops → destination).
 * Shows scheduled times with actual/predicted times overlaid when real-time data is available.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { TimelineSegmentLeg } from "../Timeline";
import { TIMELINE_CIRCLE_SIZE } from "../Timeline/config";
import type { Segment } from "./types";
import { useScheduledTripDisplayData } from "./useScheduledTripDisplayData";
import {
  computeTimelineStateForJourney,
  type ScheduledTripCardDisplayState,
  type ScheduledTripTimelineState,
} from "./utils/computePageDisplayState";
import { getDepartingTerminalAbbrevs } from "./utils/segmentUtils";

// ============================================================================
// Types
// ============================================================================

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
   * Departure terminal for active-segment selection. When omitted, derived from
   * segments[0].DepartingTerminalAbbrev.
   */
  terminalAbbrev?: string;
  /**
   * When provided, the timeline is purely presentational and does not call
   * useScheduledTripDisplayData. Use for list cards that receive page-level display state.
   */
  displayState?: ScheduledTripCardDisplayState;
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
 * When displayState is provided (e.g. from the list page), renders presentational content only
 * and does not fetch. Otherwise fetches via useScheduledTripDisplayData and computes with
 * computeTimelineStateForJourney.
 *
 * @param vesselAbbrev - Vessel abbreviation for the trip
 * @param segments - Array of trip segments to display
 * @param displayState - Optional full card display state; when set, no hook is called
 * @returns A View component with a sequence of markers and progress bars, or null
 */
export const ScheduledTripTimeline = (props: ScheduledTripTimelineProps) => {
  if (props.displayState != null) {
    return (
      <ScheduledTripTimelineFromDisplayState
        displayState={props.displayState}
        segments={props.segments}
      />
    );
  }
  return (
    <ScheduledTripTimelineWithData
      vesselAbbrev={props.vesselAbbrev}
      segments={props.segments}
      terminalAbbrev={props.terminalAbbrev}
    />
  );
};

// ============================================================================
// Display-state path (no hook, presentational only)
// ============================================================================

/**
 * Renders timeline from page-level display state. Returns null when display state is
 * incomplete (missing vesselLocation, vesselTripMap, or timeline).
 */
const ScheduledTripTimelineFromDisplayState = ({
  displayState,
  segments,
}: {
  displayState: ScheduledTripCardDisplayState;
  segments: Segment[];
}) => {
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
// Data-fetching path (no display state from parent)
// ============================================================================

/**
 * Fetches vessel/trip data and computes timeline via computeTimelineStateForJourney,
 * then renders ScheduledTripTimelineContent. Only mounted when parent does not provide display state.
 */
const ScheduledTripTimelineWithData = ({
  vesselAbbrev,
  segments,
  terminalAbbrev,
}: {
  vesselAbbrev: string;
  segments: Segment[];
  terminalAbbrev?: string;
}) => {
  const sailingDay = segments[0]?.SailingDay;
  const departingTerminalAbbrevs = getDepartingTerminalAbbrevs(segments);

  const fetched = useScheduledTripDisplayData({
    vesselAbbrev,
    sailingDay,
    departingTerminalAbbrevs,
  });

  const vesselLocation = fetched.vesselLocation;
  const displayTrip = fetched.displayTrip;
  const vesselTripMap = fetched.vesselTripMap;

  if (!vesselLocation || !vesselTripMap || segments.length === 0) return null;

  const resolvedTerminalAbbrev =
    terminalAbbrev ?? segments[0]?.DepartingTerminalAbbrev ?? "";
  const journey = {
    id: `${vesselAbbrev}-${segments[0]?.Key ?? "single"}`,
    vesselAbbrev,
    segments,
  };

  const timelineState = computeTimelineStateForJourney({
    terminalAbbrev: resolvedTerminalAbbrev,
    journey,
    vesselLocation,
    displayTrip,
    vesselTripMap,
  });

  return (
    <ScheduledTripTimelineContent
      segments={segments}
      vesselLocation={vesselLocation}
      vesselTripMap={vesselTripMap}
      displayTrip={displayTrip}
      timelineState={timelineState}
    />
  );
};

// ============================================================================
// Presentational content (no hooks, no display-state logic)
// ============================================================================

/**
 * Renders timeline legs from pre-computed data. Used by both the display-state path
 * (list cards) and the with-data path (standalone timeline).
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
