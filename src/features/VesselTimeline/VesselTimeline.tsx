/**
 * Main VesselTimeline feature component.
 *
 * This component owns the vessel-day provider boundary and renders the
 * day-level timeline content from the normalized vessel-centric data source.
 */

import {
  createTimelineVisualTheme,
  type TimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "@/components/timeline";
import { Text, View } from "@/components/ui";
import {
  ConvexVesselTripEventsProvider,
  useConvexVesselTripEvents,
} from "@/data/contexts";
import { useNowMs } from "@/shared/hooks";
import { TimelineContent } from "./components/TimelineContent";
import { getVesselTimelineRenderState } from "./utils";

type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  routeAbbrevs: string[];
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};

/**
 * Public feature component for the vessel-day timeline.
 *
 * @param props - Vessel timeline props
 * @param props.vesselAbbrev - Vessel abbreviation to display
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.routeAbbrevs - Route abbreviations carried by the caller
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @returns Vessel-day timeline feature
 */
export const VesselTimeline = ({
  vesselAbbrev,
  sailingDay,
  routeAbbrevs: _routeAbbrevs,
  now,
  theme,
}: VesselTimelineProps) => {
  const resolvedTheme = createTimelineVisualTheme(theme);

  return (
    <ConvexVesselTripEventsProvider
      vesselAbbrev={vesselAbbrev}
      sailingDay={sailingDay}
    >
      <VesselTimelineContent now={now} theme={resolvedTheme} />
    </ConvexVesselTripEventsProvider>
  );
};

type VesselTimelineContentProps = {
  now?: Date;
  theme: TimelineVisualTheme;
};

/**
 * Inner content component that consumes the vessel-day context.
 *
 * @param props - Inner content props
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @returns Loading, empty, error, or ready vessel timeline content
 */
const VesselTimelineContent = ({ now, theme }: VesselTimelineContentProps) => {
  const nowMs = useNowMs(1000);
  const {
    VesselAbbrev,
    SailingDay,
    Events,
    VesselLocation,
    IsLoading,
    Error: errorMessage,
  } = useConvexVesselTripEvents();

  if (IsLoading) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-semibold text-lg">
          Loading vessel timeline...
        </Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-semibold text-destructive text-lg">
          Unable to load vessel timeline
        </Text>
        <Text className="mt-2 text-center text-muted-foreground text-sm">
          {errorMessage}
        </Text>
      </View>
    );
  }

  if (Events.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-semibold text-lg">No vessel timeline found</Text>
        <Text className="mt-2 text-center text-muted-foreground text-sm">
          No vessel trip events were found for {VesselAbbrev} on {SailingDay}.
        </Text>
      </View>
    );
  }

  const renderState = getVesselTimelineRenderState(
    Events,
    VesselLocation,
    now ?? new Date(nowMs)
  );

  return <TimelineContent {...renderState} theme={theme} />;
};
