/**
 * View-model hook for the VesselTimeline feature.
 */

import type { TimelineVisualTheme } from "@/components/timeline";
import { useConvexVesselTimeline, useTerminalsData } from "@/data/contexts";
import { useNowMs } from "@/shared/hooks";
import {
  buildRowsFromEvents,
  getStaticVesselTimelineRenderState,
  getVesselTimelineActiveIndicator,
  resolveActiveRowIdFromInterval,
} from "../renderState";
import type { VesselTimelineRenderState } from "../types";

export type UseVesselTimelineViewModelResult = {
  isLoading: boolean;
  error: string | null;
  emptyMessage: string | null;
  retry: () => void;
  renderState: VesselTimelineRenderState | null;
};

/**
 * Builds the screen-level VesselTimeline state from the backend-owned event
 * contract plus feature-owned row derivation and render helpers.
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
    events,
    activeInterval,
    live,
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

  if (events.length === 0) {
    return {
      isLoading: false,
      error: null,
      emptyMessage: `No vessel trip events were found for ${VesselAbbrev} on ${SailingDay}.`,
      retry: Retry,
      renderState: null,
    };
  }

  const rows = buildRowsFromEvents(events);
  const activeRowId = resolveActiveRowIdFromInterval(rows, activeInterval);

  const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
    terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()]
      ?.TerminalName ?? null;
  const staticRenderState = getStaticVesselTimelineRenderState(
    rows,
    activeRowId,
    getTerminalNameByAbbrev,
    undefined,
    theme
  );

  return {
    isLoading: false,
    error: null,
    emptyMessage: null,
    retry: Retry,
    renderState: {
      ...staticRenderState,
      activeIndicator: getVesselTimelineActiveIndicator({
        rows,
        activeRowId,
        liveState: live,
        now: now ?? new Date(nowMs),
      }),
    },
  };
};
