/**
 * Main VesselTimeline feature component.
 *
 * Owns the vessel-day provider boundary and renders the timeline from Convex
 * event-row subscriptions (`ConvexVesselTimelineEventsProvider`). Vessel
 * locations and terminal identity are supplied by app-level providers above
 * this feature; the presentation hook reads them for current position and
 * labels.
 */

import { useState } from "react";
import {
  createTimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "@/components/timeline";
import { Button, Text } from "@/components/ui";
import { ConvexVesselTimelineEventsProvider } from "@/data/contexts";
import { useVesselTimelinePresentationState } from "./hooks/useVesselTimelinePresentationState";
import { getVesselTimelineDataHostKey } from "./utils/hostKey";
import { VesselTimelineContent } from "./VesselTimelineContent";
import { VesselTimelineStatusView } from "./VesselTimelineStatusView";

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
 * @param props.theme - Optional timeline theme overrides
 * @returns Vessel-day timeline feature
 */
export const VesselTimeline = ({
  vesselAbbrev,
  sailingDay,
  now,
  theme,
}: VesselTimelineProps) => {
  return (
    <VesselTimelineDataHost
      vesselAbbrev={vesselAbbrev}
      sailingDay={sailingDay}
      now={now}
      theme={theme}
    />
  );
};

/**
 * Hosts `ConvexVesselTimelineEventsProvider` for the vessel-day query scope and
 * remount/retry wiring.
 *
 * @param props - Data-host props
 * @param props.vesselAbbrev - Vessel abbreviation to display
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @param props.theme - Optional timeline theme overrides
 * @returns Provider-mounted VesselTimeline presentation
 */
const VesselTimelineDataHost = ({
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
  const providerKey = getVesselTimelineDataHostKey(
    vesselAbbrev,
    sailingDay,
    retryNonce
  );

  return (
    <ConvexVesselTimelineEventsProvider
      key={providerKey}
      sailingDay={sailingDay}
      vesselAbbrev={vesselAbbrev}
      onRetry={retry}
    >
      <VesselTimelinePresentation now={now} theme={resolvedTheme} />
    </ConvexVesselTimelineEventsProvider>
  );
};

/**
 * Renders event-row-backed VesselTimeline presentation state.
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
  const state = useVesselTimelinePresentationState({
    now,
    theme,
  });

  return <VesselTimelinePresentationBody {...state} />;
};

/**
 * Renders shared status and ready branches for timeline presentation state.
 *
 * @param props - Presentation-state props
 * @param props.isLoading - Whether timeline data is loading
 * @param props.error - Error message, when present
 * @param props.emptyMessage - Empty-state message, when present
 * @param props.retry - Retry callback for error state
 * @param props.renderState - Final render state for content branch
 * @returns Loading, error, empty, or ready timeline UI
 */
const VesselTimelinePresentationBody = ({
  isLoading,
  error,
  emptyMessage,
  retry,
  renderState,
}: {
  isLoading: boolean;
  error: string | null;
  emptyMessage: string | null;
  retry: () => void;
  renderState: ReturnType<
    typeof useVesselTimelinePresentationState
  >["renderState"];
}) => {
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

  return renderState ? <VesselTimelineContent {...renderState} /> : null;
};
