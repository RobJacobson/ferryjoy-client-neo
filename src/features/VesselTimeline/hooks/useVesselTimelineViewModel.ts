/**
 * View-model hook for the VesselTimeline feature.
 */

import type { TimelineVisualTheme } from "@/components/timeline";
import { useConvexVesselTimeline } from "@/data/contexts";
import { useNowMs } from "@/shared/hooks";
import { getVesselTimelineRenderState } from "../renderState";
import type { VesselTimelineRenderState } from "../types";

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
  const {
    VesselAbbrev,
    SailingDay,
    Segments,
    LiveState,
    ActiveState,
    IsLoading,
    ErrorMessage,
    Retry,
  } = useConvexVesselTimeline();

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

  if (Segments.length === 0) {
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
    renderState: getVesselTimelineRenderState(
      Segments,
      LiveState,
      ActiveState,
      now ?? new Date(nowMs),
      undefined,
      theme
    ),
  };
};
