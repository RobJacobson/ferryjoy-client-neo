/**
 * Pure presentation-state builders for VesselTimeline pipeline wiring.
 */

import type { RouteTimelineSnapshot } from "convex/functions/routeTimeline";
import type { TimelineVisualTheme } from "@/components/timeline";
import type { VesselLocation } from "@/types";
import { fromRouteTimelineModel } from "../renderPipeline/fromRouteTimelineModel";
import type { VesselTimelineRenderState } from "../types";

type UseVesselTimelinePresentationStateResult = {
  isLoading: boolean;
  error: string | null;
  emptyMessage: string | null;
  retry: () => void;
  renderState: VesselTimelineRenderState | null;
};

type RouteModelPresentationData = {
  vesselAbbrev?: string;
  sailingDay: string;
  snapshot: RouteTimelineSnapshot | null;
  isLoading: boolean;
  errorMessage: string | null;
  retry: () => void;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  currentVesselLocation: VesselLocation | null;
  now: Date;
  theme: TimelineVisualTheme;
};

/**
 * Build route-model-backed VesselTimeline presentation state.
 *
 * @param args - Route-model pipeline inputs
 * @returns Loading, error, empty, or ready presentation state
 */
export const buildRouteModelTimelinePresentationState = ({
  vesselAbbrev,
  sailingDay,
  snapshot,
  isLoading,
  errorMessage,
  retry,
  getTerminalNameByAbbrev,
  currentVesselLocation,
  now,
  theme,
}: RouteModelPresentationData): UseVesselTimelinePresentationStateResult => {
  if (isLoading) {
    return {
      isLoading: true,
      error: null,
      emptyMessage: null,
      retry,
      renderState: null,
    };
  }

  if (errorMessage) {
    return {
      isLoading: false,
      error: errorMessage,
      emptyMessage: null,
      retry,
      renderState: null,
    };
  }

  const resolvedVesselAbbrev = vesselAbbrev ?? "";
  const renderState = fromRouteTimelineModel({
    snapshot,
    vesselAbbrev: resolvedVesselAbbrev,
    getTerminalNameByAbbrev,
    vesselLocation: currentVesselLocation,
    now,
    theme,
  });

  if (renderState.rows.length === 0) {
    return {
      isLoading: false,
      error: null,
      emptyMessage: `No vessel timeline events were found for ${resolvedVesselAbbrev} on ${sailingDay}.`,
      retry,
      renderState: null,
    };
  }

  return {
    isLoading: false,
    error: null,
    emptyMessage: null,
    retry,
    renderState,
  };
};
