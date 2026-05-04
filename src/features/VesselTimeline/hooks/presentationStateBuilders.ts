/**
 * Pure presentation-state builders for VesselTimeline pipeline wiring.
 */

import type { TimelineVisualTheme } from "@/components/timeline";
import type { ConvexVesselTimelineEventsContextType } from "@/data/contexts/convex/convexVesselTimelineEventsValue";
import type { VesselLocation } from "@/types";
import { fromEventRows } from "../renderPipeline/fromEventRows";
import type { VesselTimelineRenderState } from "../types";

type UseVesselTimelinePresentationStateResult = {
  isLoading: boolean;
  error: string | null;
  emptyMessage: string | null;
  retry: () => void;
  renderState: VesselTimelineRenderState | null;
};

type EventRowPresentationData = {
  events: ConvexVesselTimelineEventsContextType;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  currentVesselLocation: VesselLocation | null;
  now: Date;
  theme: TimelineVisualTheme;
};

/**
 * Build VesselTimeline presentation state from vessel-day event row context.
 *
 * @param args - Event-row pipeline inputs and shared presentation inputs
 * @returns Loading, error, empty, or ready presentation state
 */
const buildEventRowTimelinePresentationState = ({
  events,
  getTerminalNameByAbbrev,
  currentVesselLocation,
  now,
  theme,
}: EventRowPresentationData): UseVesselTimelinePresentationStateResult => {
  const {
    vesselAbbrev,
    sailingDay,
    isLoading,
    errorMessage,
    retry,
    scheduledEvents,
    actualEvents,
    predictedEvents,
  } = events;

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

  const renderState = fromEventRows({
    scheduledEvents,
    actualEvents,
    predictedEvents,
    vesselAbbrev,
    sailingDay,
    getTerminalNameByAbbrev,
    vesselLocation: currentVesselLocation,
    now,
    theme,
  });

  if (renderState.rows.length === 0) {
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
    renderState,
  };
};

export type {
  EventRowPresentationData,
  UseVesselTimelinePresentationStateResult,
};
export { buildEventRowTimelinePresentationState };
