/**
 * Main VesselTimeline feature component.
 *
 * This component owns the vessel-day provider boundary and renders the
 * day-level timeline content from the normalized vessel-centric data source.
 */

import { useState } from "react";
import {
  createTimelineVisualTheme,
  type TimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "@/components/timeline";
import { Button, Text, View } from "@/components/ui";
import {
  ConvexVesselTimelineProvider,
  useConvexVesselTimeline,
} from "@/data/contexts";
import { useNowMs } from "@/shared/hooks";
import { TimelineContent } from "./components/TimelineContent";
import { getVesselTimelineRenderState } from "./utils";

type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};

/**
 * Public feature component for the vessel-day timeline.
 *
 * @param props - Vessel timeline props
 * @param props.vesselAbbrev - Vessel abbreviation to display
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @returns Vessel-day timeline feature
 */
export const VesselTimeline = ({
  vesselAbbrev,
  sailingDay,
  now,
  theme,
}: VesselTimelineProps) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const resolvedTheme = createTimelineVisualTheme(theme);
  const providerKey = `${vesselAbbrev}:${sailingDay}:${retryNonce}`;

  return (
    <ConvexVesselTimelineProvider
      key={providerKey}
      vesselAbbrev={vesselAbbrev}
      sailingDay={sailingDay}
      onRetry={() => {
        setRetryNonce((current) => current + 1);
      }}
    >
      <VesselTimelineContent now={now} theme={resolvedTheme} />
    </ConvexVesselTimelineProvider>
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
    Segments,
    LiveState,
    ActiveState,
    IsLoading,
    Error: errorMessage,
    Retry,
  } = useConvexVesselTimeline();
  const currentNow = now ?? new Date(nowMs);

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
        <Text className="mt-1 text-center text-muted-foreground text-sm">
          Please try again.
        </Text>
        <Button className="mt-4" onPress={Retry} variant="outline">
          <Text>Try again</Text>
        </Button>
      </View>
    );
  }

  if (Segments.length === 0) {
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
    Segments,
    LiveState,
    ActiveState,
    currentNow,
    undefined,
    theme
  );

  return <TimelineContent {...renderState} />;
};
