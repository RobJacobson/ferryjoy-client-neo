/**
 * Main VesselTimeline feature component.
 *
 * This component owns the vessel-day provider boundary and renders the
 * day-level timeline content from the backend-owned backbone query result.
 */

import { useState } from "react";
import {
  createTimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "@/components/timeline";
import { Button, Text } from "@/components/ui";
import {
  ConvexRouteTimelineProvider,
  useConvexVesselLocations,
} from "@/data/contexts";
import { useRouteModelVesselTimelinePresentationState } from "./hooks";
import { shouldWaitForVesselTimelineRouteScope } from "./pipelineMode";
import { getVesselTimelineDataHostKey } from "./utils";
import { VesselTimelineContent } from "./VesselTimelineContent";
import { VesselTimelineStatusView } from "./VesselTimelineStatusView";

type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  routeAbbrev?: string;
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};

/**
 * Public feature component for the vessel-day timeline.
 *
 * @param props - Vessel timeline props
 * @param props.vesselAbbrev - Vessel abbreviation to display
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.routeAbbrev - Optional route abbreviation for route-model data
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @returns Vessel-day timeline feature
 */
export const VesselTimeline = ({
  vesselAbbrev,
  sailingDay,
  routeAbbrev,
  now,
  theme,
}: VesselTimelineProps) => {
  return (
    <VesselTimelineDataHost
      vesselAbbrev={vesselAbbrev}
      sailingDay={sailingDay}
      routeAbbrev={routeAbbrev}
      now={now}
      theme={theme}
    />
  );
};

/**
 * Hosts route timeline data providers for VesselTimeline presentation.
 *
 * @param props - Data-host props
 * @param props.vesselAbbrev - Vessel abbreviation to display
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.routeAbbrev - Optional route abbreviation for route-model data
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @param props.theme - Optional timeline theme overrides
 * @returns Provider-mounted VesselTimeline presentation
 */
const VesselTimelineDataHost = ({
  vesselAbbrev,
  sailingDay,
  routeAbbrev,
  now,
  theme,
}: VesselTimelineProps) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const { vesselLocations, isLoading: isVesselLocationsLoading } =
    useConvexVesselLocations();
  const resolvedTheme = createTimelineVisualTheme(theme);
  const resolvedRouteAbbrev =
    routeAbbrev ??
    vesselLocations.find((location) => location.VesselAbbrev === vesselAbbrev)
      ?.RouteAbbrev ??
    undefined;
  const isResolvingRouteScope = shouldWaitForVesselTimelineRouteScope({
    routeAbbrev: resolvedRouteAbbrev,
    isRouteScopeLoading: isVesselLocationsLoading,
  });
  const retry = () => {
    setRetryNonce((current) => current + 1);
  };
  const providerKey = getVesselTimelineDataHostKey(
    vesselAbbrev,
    sailingDay,
    retryNonce
  );

  if (isResolvingRouteScope) {
    return <VesselTimelineStatusView message="Loading vessel timeline..." />;
  }

  if (!resolvedRouteAbbrev) {
    return (
      <VesselTimelineStatusView
        message="No vessel timeline found"
        detail={`No route was found for ${vesselAbbrev} on ${sailingDay}.`}
      />
    );
  }

  return (
    <ConvexRouteTimelineProvider
      key={providerKey}
      routeAbbrev={resolvedRouteAbbrev}
      sailingDay={sailingDay}
      vesselAbbrev={vesselAbbrev}
      onRetry={retry}
    >
      <RouteModelVesselTimelinePresentation now={now} theme={resolvedTheme} />
    </ConvexRouteTimelineProvider>
  );
};

/**
 * Renders route-model-backed VesselTimeline presentation state.
 *
 * @param props - Presentation props
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @param props.theme - Resolved visual theme for timeline rendering
 * @returns Loading, error, empty, or ready timeline UI
 */
const RouteModelVesselTimelinePresentation = ({
  now,
  theme,
}: {
  now?: Date;
  theme: ReturnType<typeof createTimelineVisualTheme>;
}) => {
  const state = useRouteModelVesselTimelinePresentationState({
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
    typeof useRouteModelVesselTimelinePresentationState
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
