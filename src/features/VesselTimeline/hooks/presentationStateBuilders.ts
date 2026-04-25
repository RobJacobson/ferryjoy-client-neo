/**
 * Pure presentation-state builders for VesselTimeline pipeline wiring.
 */

import type { RouteTimelineSnapshot } from "convex/functions/routeTimeline";
import type { VesselTimelineEvent } from "convex/functions/vesselTimeline/schemas";
import { resolveActiveTimelineInterval } from "shared/activeTimelineInterval";
import type { TimelineVisualTheme } from "@/components/timeline";
import type { VesselLocation } from "@/types";
import {
  fromRouteTimelineModel,
  getVesselTimelineRenderState,
} from "../renderPipeline";
import type { VesselTimelineRenderState } from "../types";

export type UseVesselTimelinePresentationStateResult = {
  isLoading: boolean;
  error: string | null;
  emptyMessage: string | null;
  retry: () => void;
  renderState: VesselTimelineRenderState | null;
};

type LegacyPresentationData = {
  vesselAbbrev: string;
  sailingDay: string;
  events: Array<VesselTimelineEvent>;
  isLoading: boolean;
  errorMessage: string | null;
  retry: () => void;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  currentVesselLocation: VesselLocation | null;
  now: Date;
  theme: TimelineVisualTheme;
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
 * Build legacy event-backed VesselTimeline presentation state.
 *
 * @param args - Legacy pipeline inputs
 * @returns Loading, error, empty, or ready presentation state
 */
export const buildLegacyTimelinePresentationState = ({
  vesselAbbrev,
  sailingDay,
  events,
  isLoading,
  errorMessage,
  retry,
  getTerminalNameByAbbrev,
  currentVesselLocation,
  now,
  theme,
}: LegacyPresentationData): UseVesselTimelinePresentationStateResult => {
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

  if (events.length === 0) {
    return {
      isLoading: false,
      error: null,
      emptyMessage: `No vessel timeline events were found for ${vesselAbbrev} on ${sailingDay}.`,
      retry,
      renderState: null,
    };
  }

  return {
    isLoading: false,
    error: null,
    emptyMessage: null,
    retry,
    renderState: getVesselTimelineRenderState({
      events,
      activeInterval: resolveActiveTimelineInterval(events),
      vesselLocation: currentVesselLocation,
      now,
      getTerminalNameByAbbrev,
      theme,
    }),
  };
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
