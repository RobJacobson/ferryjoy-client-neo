/**
 * View-model hook for the VesselTimeline feature.
 */

import { useMemo } from "react";
import type { TimelineVisualTheme } from "@/components/timeline";
import { useConvexVesselTimeline, useTerminalsData } from "@/data/contexts";
import { useNowMs } from "@/shared/hooks";
import {
  getStaticVesselTimelineRenderState,
  getVesselTimelineActiveIndicator,
} from "../renderState";
import type { VesselTimelineRenderState } from "../types";
import { buildSegmentsFromBoundaryEvents } from "../utils/buildSegmentsFromBoundaryEvents";
import { resolveActiveStateFromTimeline } from "../utils/resolveActiveStateFromTimeline";

export type UseVesselTimelineViewModelResult = {
  isLoading: boolean;
  error: string | null;
  emptyMessage: string | null;
  retry: () => void;
  renderState: VesselTimelineRenderState | null;
};

/**
 * Builds the screen-level VesselTimeline state from Convex data and the
 * feature's render-state helpers.
 *
 * @param args - Hook inputs
 * @param args.now - Optional wall-clock override for deterministic rendering
 * @param args.theme - Resolved visual theme for timeline rendering
 * @returns Plain screen state for loading, error, empty, and ready branches
 */
export const useVesselTimelineViewModel = ({
  now,
  theme,
}: {
  now?: Date;
  theme: TimelineVisualTheme;
}): UseVesselTimelineViewModelResult => {
  const nowMs = useNowMs(1000);
  const terminalsData = useTerminalsData();
  const {
    VesselAbbrev,
    SailingDay,
    mergedEvents,
    location,
    IsLoading,
    ErrorMessage,
    Retry,
  } = useConvexVesselTimeline();
  const segments = useMemo(
    () =>
      buildSegmentsFromBoundaryEvents(
        mergedEvents,
        (terminalAbbrev) =>
          terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()]
            ?.TerminalName ?? null
      ),
    [mergedEvents, terminalsData]
  );
  const { Live: liveState, ActiveState: activeState } = useMemo(
    () => resolveActiveStateFromTimeline({ segments, location }),
    [segments, location]
  );
  const staticRenderState = useMemo(
    () =>
      getStaticVesselTimelineRenderState(
        segments,
        activeState,
        undefined,
        theme
      ),
    [activeState, segments, theme]
  );

  if (IsLoading) {
    return {
      isLoading: true,
      error: null,
      emptyMessage: null,
      retry: Retry,
      renderState: null,
    };
  }

  if (ErrorMessage) {
    return {
      isLoading: false,
      error: ErrorMessage,
      emptyMessage: null,
      retry: Retry,
      renderState: null,
    };
  }

  if (segments.length === 0) {
    return {
      isLoading: false,
      error: null,
      emptyMessage: `No vessel trip events were found for ${VesselAbbrev} on ${SailingDay}.`,
      retry: Retry,
      renderState: null,
    };
  }

  return {
    isLoading: false,
    error: null,
    emptyMessage: null,
    retry: Retry,
    renderState: {
      ...staticRenderState,
      activeIndicator: getVesselTimelineActiveIndicator({
        segments,
        activeState,
        liveState,
        now: now ?? new Date(nowMs),
      }),
    },
  };
};
