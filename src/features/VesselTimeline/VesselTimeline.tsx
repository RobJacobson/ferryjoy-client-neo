/**
 * Main VesselTimeline feature component.
 *
 * This component owns the vessel-day provider boundary and renders the
 * day-level timeline content from the normalized vessel-centric data source.
 */

import { Text, View } from "@/components/ui";
import {
  ConvexVesselDayTimelineProvider,
  useConvexVesselDayTimeline,
} from "@/data/contexts";
import { TimelineContent } from "./components/TimelineContent";
import { getVesselTimelineRenderState } from "./utils";

type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  routeAbbrevs: string[];
  now?: Date;
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
}: VesselTimelineProps) => (
  <ConvexVesselDayTimelineProvider
    vesselAbbrev={vesselAbbrev}
    sailingDay={sailingDay}
  >
    <VesselTimelineContent now={now} />
  </ConvexVesselDayTimelineProvider>
);

type VesselTimelineContentProps = {
  now?: Date;
};

/**
 * Inner content component that consumes the vessel-day context.
 *
 * @param props - Inner content props
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @returns Loading, empty, error, or ready vessel timeline content
 */
const VesselTimelineContent = ({ now }: VesselTimelineContentProps) => {
  const { vesselAbbrev, sailingDay, trips, vesselLocation, isLoading, error } =
    useConvexVesselDayTimeline();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-semibold text-lg">
          Loading vessel timeline...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-semibold text-destructive text-lg">
          Unable to load vessel timeline
        </Text>
        <Text className="mt-2 text-center text-muted-foreground text-sm">
          {error}
        </Text>
      </View>
    );
  }

  if (trips.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-semibold text-lg">No scheduled trips found</Text>
        <Text className="mt-2 text-center text-muted-foreground text-sm">
          No direct scheduled trips were found for {vesselAbbrev} on{" "}
          {sailingDay}.
        </Text>
      </View>
    );
  }

  const renderState = getVesselTimelineRenderState(
    trips,
    vesselLocation,
    now ?? new Date()
  );

  return <TimelineContent {...renderState} />;
};
