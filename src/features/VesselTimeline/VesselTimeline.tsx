/**
 * Main VesselTimeline feature component.
 *
 * This component owns the vessel-day provider boundary and renders the
 * day-level timeline content from the normalized vessel-centric data source.
 */

import { useState } from "react";
import {
  createTimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "@/components/timeline";
import { Button, Text } from "@/components/ui";
import { ConvexVesselTimelineProvider } from "@/data/contexts";
import { useVesselTimelineViewModel } from "./hooks";
import { TimelineContent } from "./TimelineContent";
import { getVesselTimelineDataHostKey } from "./utils";
import { VesselTimelineStatusView } from "./VesselTimelineStatusView";

export type VesselTimelineProps = {
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
  const retry = () => {
    setRetryNonce((current) => current + 1);
  };

  return (
    <ConvexVesselTimelineProvider
      key={getVesselTimelineDataHostKey(vesselAbbrev, sailingDay, retryNonce)}
      vesselAbbrev={vesselAbbrev}
      sailingDay={sailingDay}
      onRetry={retry}
    >
      <VesselTimelinePresentation now={now} theme={resolvedTheme} />
    </ConvexVesselTimelineProvider>
  );
};

/**
 * Renders the user-visible VesselTimeline states from the hook-based view
 * model.
 *
 * @param props - Presentation props
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @param props.theme - Resolved visual theme for timeline rendering
 * @returns Loading, error, empty, or ready timeline UI
 */
const VesselTimelinePresentation = ({
  now,
  theme,
}: {
  now?: Date;
  theme: ReturnType<typeof createTimelineVisualTheme>;
}) => {
  const { isLoading, error, emptyMessage, retry, renderState } =
    useVesselTimelineViewModel({
      now,
      theme,
    });

  if (isLoading) {
    return <VesselTimelineStatusView message="Loading vessel timeline..." />;
  }

  if (error) {
    return (
      <VesselTimelineStatusView
        action={
          <Button className="mt-4" onPress={retry} variant="outline">
            <Text>Try again</Text>
          </Button>
        }
        detail={error}
        message="Unable to load vessel timeline"
        tone="destructive"
      />
    );
  }

  if (emptyMessage) {
    return (
      <VesselTimelineStatusView
        detail={emptyMessage}
        message="No vessel timeline found"
      />
    );
  }

  return renderState ? <TimelineContent {...renderState} /> : null;
};
