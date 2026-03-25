/**
 * Context-backed state branching for the VesselTimeline feature.
 */

import type { TimelineVisualTheme } from "@/components/timeline";
import { Button, Text } from "@/components/ui";
import { useConvexVesselTimeline } from "@/data/contexts";
import {
  VesselTimelineLiveReadyContent,
  VesselTimelineReadyContent,
} from "./VesselTimelineReadyContent";
import { VesselTimelineStatusView } from "./VesselTimelineStatusView";

export type VesselTimelineDataContainerProps = {
  now?: Date;
  theme: TimelineVisualTheme;
};

/**
 * Consumes the vessel-day context and branches into loading, error, empty, or
 * ready feature states.
 *
 * @param props - Container props
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @returns Loading, empty, error, or ready vessel timeline content
 */
export const VesselTimelineDataContainer = ({
  now,
  theme,
}: VesselTimelineDataContainerProps) => {
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

  if (IsLoading) {
    return <VesselTimelineStatusView message="Loading vessel timeline..." />;
  }

  if (errorMessage) {
    return (
      <VesselTimelineStatusView
        action={
          <Button className="mt-4" onPress={Retry} variant="outline">
            <Text>Try again</Text>
          </Button>
        }
        detail={errorMessage}
        message="Unable to load vessel timeline"
        tone="destructive"
      />
    );
  }

  if (Segments.length === 0) {
    return (
      <VesselTimelineStatusView
        detail={`No vessel trip events were found for ${VesselAbbrev} on ${SailingDay}.`}
        message="No vessel timeline found"
      />
    );
  }

  if (now) {
    return (
      <VesselTimelineReadyContent
        now={now}
        theme={theme}
        segments={Segments}
        liveState={LiveState}
        activeState={ActiveState}
      />
    );
  }

  return (
    <VesselTimelineLiveReadyContent
      theme={theme}
      segments={Segments}
      liveState={LiveState}
      activeState={ActiveState}
    />
  );
};
