/**
 * VesselTripTimelineVertical renders a vertical, time-scaled timeline of a vessel's daily journey.
 * Uses absolute positioning based on a pixels-per-hour constant.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { ScrollView, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { Text } from "@/components/ui";
import {
  TimelineIndicator,
  TimelineMarker,
  TimelineMarkerContent,
  TimelineMarkerLabel,
  TimelineMarkerTime,
} from "../Timeline";
import { useVesselDailyTimeline } from "./hooks";

// ============================================================================
// Types
// ============================================================================

type VesselTimeline = {
  vesselAbbrev: string;
  vesselLocation: VesselLocation | null;
  className?: string;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Displays a vertical timeline of all direct trips for a single vessel on the current sailing day.
 * Staggers arrivals on the left and departures on the right.
 *
 * @param vesselAbbrev - Vessel abbreviation (e.g., "SEA")
 * @param vesselLocation - Real-time vessel location data
 * @param className - Optional container styling
 */
export const VesselTimeline = ({
  vesselAbbrev,
  vesselLocation,
  className,
}: VesselTimeline) => {
  const timelineData = useVesselDailyTimeline(vesselAbbrev, vesselLocation);
  const progressValue = useSharedValue(0);

  if (!timelineData) {
    return (
      <View className="p-8 items-center justify-center">
        <Text className="text-muted-foreground">
          No schedule data available for this vessel today.
        </Text>
      </View>
    );
  }

  const {
    totalHeight,
    events,
    currentProgressMs,
    currentOffsetY,
    windowStartMs,
    windowEndMs,
    vesselName,
    speed,
  } = timelineData;

  // Calculate progress as a fraction of the total window for the indicator
  const progressFraction =
    (currentProgressMs - windowStartMs) / (windowEndMs - windowStartMs);
  progressValue.value = progressFraction;

  // First departure offset for the pink bar start
  const firstEventOffsetY = events.length > 0 ? events[0].offsetY : 0;

  // Pink bar height: from first departure to current position (clamped)
  const pinkBarHeight = Math.max(
    0,
    Math.min(
      currentOffsetY - firstEventOffsetY,
      totalHeight - firstEventOffsetY
    )
  );

  return (
    <ScrollView
      className={className}
      contentContainerStyle={{ paddingVertical: 60 }}
    >
      <View
        style={{ height: totalHeight }}
        className="relative mx-auto w-full max-w-[350px]"
      >
        {/* 1. The Vertical Track (Background) */}
        <View
          className="absolute left-1/2 -ml-[2px] w-[4px] h-full bg-muted/20 rounded-full"
          style={{ zIndex: 1 }}
        />

        {/* 2. The Progress Bar (Pink) */}
        <View
          className="absolute left-1/2 -ml-[2px] w-[4px] bg-pink-300 rounded-full"
          style={{
            top: firstEventOffsetY,
            height: pinkBarHeight,
            zIndex: 2,
          }}
        />

        {/* 3. The Events (Staggered) */}
        {events.map((event) => {
          const isArrival = event.type === "arrival";
          const isCompleted = event.time.getTime() < currentProgressMs;

          return (
            <TimelineMarker
              key={event.id}
              orientation="vertical"
              circleClassName={
                isCompleted
                  ? "bg-pink-100 border-pink-300"
                  : "bg-white border-muted"
              }
              style={{ top: event.offsetY }}
              zIndex={10}
            >
              <TimelineMarkerContent
                className={
                  isArrival
                    ? "ml-14 flex-row justify-end items-center"
                    : "mr-14 flex-row justify-start items-center"
                }
              >
                <TimelineMarkerLabel
                  text={`${isArrival ? "Arrive" : "Depart"} ${event.terminal}`}
                />
                <TimelineMarkerTime
                  time={event.time}
                  type={event.isActual ? "actual" : "scheduled"}
                  isBold
                />
              </TimelineMarkerContent>
            </TimelineMarker>
          );
        })}

        {/* 4. The Indicator (Rocking Vessel) */}
        <View
          className="absolute left-0 right-0"
          style={{ top: currentOffsetY, height: 0, zIndex: 20 }}
        >
          <TimelineIndicator
            progress={progressValue}
            orientation="vertical"
            animate={speed !== undefined && speed > 1}
            speed={speed}
            minutesRemaining={speed !== undefined ? Math.round(speed) : "--"}
            indicatorStyle="bg-pink-50 border-pink-500"
          >
            <View className="bg-white/90 px-2 py-1 rounded-md border border-pink-200 shadow-sm">
              <Text className="text-[10px] font-playwrite-bold text-pink-600">
                {vesselName ?? vesselAbbrev}
              </Text>
            </View>
          </TimelineIndicator>
        </View>
      </View>
    </ScrollView>
  );
};
