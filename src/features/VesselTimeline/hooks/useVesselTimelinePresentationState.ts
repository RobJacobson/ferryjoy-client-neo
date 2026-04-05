/**
 * Presentation-state hook for the VesselTimeline feature.
 */

import { resolveActiveTimelineInterval } from "shared/activeTimelineInterval";
import type { TimelineVisualTheme } from "@/components/timeline";
import {
  useConvexVesselLocations,
  useConvexVesselTimeline,
  useTerminalsData,
} from "@/data/contexts";
import { useNowMs } from "@/shared/hooks";
import { getVesselTimelineRenderState } from "../renderPipeline";
import type { VesselTimelineRenderState } from "../types";

export type UseVesselTimelinePresentationStateResult = {
  isLoading: boolean;
  error: string | null;
  emptyMessage: string | null;
  retry: () => void;
  renderState: VesselTimelineRenderState | null;
};

/**
 * Builds the screen-level VesselTimeline presentation state from the backend
 * event contract plus feature-owned render-state derivation.
 *
 * @param args - Hook inputs
 * @param args.now - Optional wall-clock override for deterministic rendering
 * @param args.theme - Resolved visual theme for timeline rendering
 * @returns Plain screen state for loading, error, empty, and ready branches
 */
export const useVesselTimelinePresentationState = ({
  now,
  theme,
}: {
  now?: Date;
  theme: TimelineVisualTheme;
}): UseVesselTimelinePresentationStateResult => {
  const nowMs = useNowMs(1000);
  const terminalsData = useTerminalsData();
  const { vesselLocations } = useConvexVesselLocations();
  const {
    vesselAbbrev,
    sailingDay,
    events,
    isLoading,
    errorMessage,
    retry,
  } = useConvexVesselTimeline();

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

  const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
    terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()]
      ?.TerminalName ?? null;
  const currentVesselLocation =
    vesselLocations.find((location) => location.VesselAbbrev === vesselAbbrev) ??
    null;

  return {
    isLoading: false,
    error: null,
    emptyMessage: null,
    retry,
    renderState: getVesselTimelineRenderState({
      events,
      activeInterval: resolveActiveTimelineInterval(events),
      vesselLocation: currentVesselLocation,
      now: now ?? new Date(nowMs),
      getTerminalNameByAbbrev,
      theme,
    }),
  };
};
