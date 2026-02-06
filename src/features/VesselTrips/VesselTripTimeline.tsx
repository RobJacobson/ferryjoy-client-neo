/**
 * TripProgressTimeline component for displaying vessel trip progress through two sequential time segments.
 * Uses TimelineSegmentLeg for a single leg (origin → destination) to share rendering with ScheduledTripTimeline.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { useMemo } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import { resolveTimeline, TimelineSegmentLeg } from "../Timeline";
import { TIMELINE_CIRCLE_SIZE } from "../Timeline/config";

import { vesselTripToSegment } from "./vesselTripToSegment";

type VesselTripTimelineProps = {
  /**
   * VesselLocation with real-time WSF data (PRIMARY source).
   */
  vesselLocation: VesselLocation;
  /**
   * VesselTrip object containing trip data with actual, predicted, and scheduled times (SECONDARY source).
   */
  trip: VesselTrip;
  /**
   * Optional className for styling the container.
   */
  className?: string;
};

/**
 * Displays vessel trip progress through two sequential time segments with intelligent time selection and dynamic width allocation.
 *
 * Delegates to TimelineSegmentLeg for a single leg (origin → destination), reusing the same rendering path
 * as ScheduledTripTimeline for consistency and reduced duplication.
 *
 * @param vesselLocation - VesselLocation with real-time WSF data (PRIMARY source)
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data (SECONDARY source)
 * @param className - Optional className for styling the meter container
 * @returns A View component with a single TimelineSegmentLeg
 */
const VesselTripTimeline = ({
  vesselLocation,
  trip,
  className,
}: VesselTripTimelineProps) => {
  const segment = useMemo(() => vesselTripToSegment(trip), [trip]);
  const vesselTripMap = useMemo(
    () =>
      trip.Key ? new Map([[trip.Key, trip]]) : new Map<string, VesselTrip>(),
    [trip]
  );

  const resolution = resolveTimeline({
    segments: [segment],
    vesselLocation,
    tripsByKey: vesselTripMap,
    nowMs: vesselLocation.TimeStamp.getTime(),
    heldTripKey: trip.Key,
  });

  return (
    <View
      className={cn(
        "relative flex-row items-center justify-between w-full overflow-visible",
        className
      )}
      style={{ minHeight: 80 }}
    >
      <TimelineSegmentLeg
        segment={segment}
        vesselLocation={vesselLocation}
        actualTrip={trip}
        circleSize={TIMELINE_CIRCLE_SIZE}
        isFirst
        isLast
        skipAtDock={false}
        legStatus={resolution.statusByKey.get(segment.Key) ?? "Pending"}
        activeKey={resolution.activeKey}
        activePhase={resolution.activePhase}
      />
    </View>
  );
};

export default VesselTripTimeline;
