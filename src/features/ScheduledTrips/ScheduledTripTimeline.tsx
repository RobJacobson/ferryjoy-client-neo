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
  resolveSingleJourneyTimeline,
  type ScheduledTripCardResolution,
  type ScheduledTripTimelineResolution,
} from "./utils/resolveScheduledTripsPageResolution";

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
   * When provided, the timeline is purely presentational and does not call
   * useScheduledTripDisplayData. Use for list cards that receive page-level resolution.
   */
  resolution?: ScheduledTripCardResolution;
};

type ScheduledTripTimelineContentProps = {
  segments: Segment[];
  vesselLocation: VesselLocation;
  vesselTripMap: Map<string, VesselTrip>;
  displayTrip: VesselTrip | undefined;
  timelineResolution: ScheduledTripTimelineResolution;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Displays a multi-segment timeline for scheduled ferry trips.
 * When resolution is provided (e.g. from the list page), renders presentational content only
 * and does not fetch. Otherwise fetches via useScheduledTripDisplayData and resolves with
 * resolveSingleJourneyTimeline.
 *
 * @param vesselAbbrev - Vessel abbreviation for the trip
 * @param segments - Array of trip segments to display
 * @param resolution - Optional full card resolution; when set, no hook is called
 * @returns A View component with a sequence of markers and progress bars, or null
 */
export const ScheduledTripTimeline = ({
  vesselAbbrev,
  segments,
  resolution,
}: ScheduledTripTimelineProps) => {
  if (resolution != null) {
    const vesselLocation = resolution.vesselLocation;
    const vesselTripMap = resolution.vesselTripMap;
    const timeline = resolution.timeline;
    if (
      !vesselLocation ||
      !vesselTripMap ||
      !timeline ||
      segments.length === 0
    ) {
      return null;
    }
    return (
      <ScheduledTripTimelineContent
        segments={segments}
        vesselLocation={vesselLocation}
        vesselTripMap={vesselTripMap}
        displayTrip={resolution.displayTrip}
        timelineResolution={timeline}
      />
    );
  }

  return (
    <ScheduledTripTimelineWithData
      vesselAbbrev={vesselAbbrev}
      segments={segments}
    />
  );
};

// ============================================================================
// Data-fetching path (no resolution from parent)
// ============================================================================

/**
 * Fetches vessel/trip data and resolves timeline via resolveSingleJourneyTimeline,
 * then renders ScheduledTripTimelineContent. Only mounted when parent does not provide resolution.
 */
const ScheduledTripTimelineWithData = ({
  vesselAbbrev,
  segments,
}: {
  vesselAbbrev: string;
  segments: Segment[];
}) => {
  const sailingDay = segments[0]?.SailingDay;
  const departingTerminalAbbrevs = [
    ...new Set(segments.map((s) => s.DepartingTerminalAbbrev)),
  ];

  const fetched = useScheduledTripDisplayData({
    vesselAbbrev,
    sailingDay,
    departingTerminalAbbrevs,
  });

  const vesselLocation = fetched.vesselLocation;
  const displayTrip = fetched.displayTrip;
  const vesselTripMap = fetched.vesselTripMap;

  if (!vesselLocation || !vesselTripMap || segments.length === 0) return null;

  const terminalAbbrev = segments[0]?.DepartingTerminalAbbrev ?? "";
  const journey = {
    id: `${vesselAbbrev}-${segments[0]?.Key ?? "single"}`,
    vesselAbbrev,
    segments,
  };

  const timelineResolution = resolveSingleJourneyTimeline({
    terminalAbbrev,
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
      timelineResolution={timelineResolution}
    />
  );
};

// ============================================================================
// Presentational content (no hooks, no resolution logic)
// ============================================================================

/**
 * Renders timeline legs from pre-resolved data. Used by both the resolution path
 * (list cards) and the with-data path (standalone timeline).
 */
const ScheduledTripTimelineContent = ({
  segments,
  vesselLocation,
  vesselTripMap,
  displayTrip,
  timelineResolution,
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
          legStatus={
            timelineResolution.statusByKey.get(segment.Key) ?? "Pending"
          }
          activeKey={timelineResolution.activeKey}
          activePhase={timelineResolution.activePhase}
        />
      ))}
    </View>
  );
};
