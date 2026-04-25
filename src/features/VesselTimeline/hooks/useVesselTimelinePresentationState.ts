/**
 * Presentation-state hook for the VesselTimeline feature.
 */

import type { TimelineVisualTheme } from "@/components/timeline";
import { useConvexRouteTimeline } from "@/data/contexts/convex/ConvexRouteTimelineContext";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTimeline } from "@/data/contexts/convex/ConvexVesselTimelineContext";
import { useTerminalsData } from "@/data/contexts/identity/TerminalsDataContext";
import { useNowMs } from "@/shared/hooks";
import {
  buildLegacyTimelinePresentationState,
  buildRouteModelTimelinePresentationState,
  type UseVesselTimelinePresentationStateResult,
} from "./presentationStateBuilders";

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
  const { vesselAbbrev, sailingDay, events, isLoading, errorMessage, retry } =
    useConvexVesselTimeline();

  const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
    terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()]
      ?.TerminalName ?? null;
  const currentVesselLocation =
    vesselLocations.find(
      (location) => location.VesselAbbrev === vesselAbbrev
    ) ?? null;

  return buildLegacyTimelinePresentationState({
    vesselAbbrev,
    sailingDay,
    events,
    isLoading,
    errorMessage,
    retry,
    getTerminalNameByAbbrev,
    currentVesselLocation,
    now: now ?? new Date(nowMs),
    theme,
  });
};

/**
 * Builds the screen-level VesselTimeline presentation state from the route
 * timeline model contract plus feature-owned render-state adaptation.
 *
 * @param args - Hook inputs
 * @param args.now - Optional wall-clock override for deterministic rendering
 * @param args.theme - Resolved visual theme for timeline rendering
 * @returns Plain screen state for loading, error, empty, and ready branches
 */
export const useRouteModelVesselTimelinePresentationState = ({
  now,
  theme,
}: {
  now?: Date;
  theme: TimelineVisualTheme;
}): UseVesselTimelinePresentationStateResult => {
  const nowMs = useNowMs(1000);
  const terminalsData = useTerminalsData();
  const { vesselLocations } = useConvexVesselLocations();
  const { snapshot, vesselAbbrev, sailingDay, isLoading, errorMessage, retry } =
    useConvexRouteTimeline();

  const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
    terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()]
      ?.TerminalName ?? null;
  const currentVesselLocation =
    vesselLocations.find(
      (location) => location.VesselAbbrev === vesselAbbrev
    ) ?? null;
  return buildRouteModelTimelinePresentationState({
    vesselAbbrev,
    sailingDay,
    snapshot,
    isLoading,
    errorMessage,
    retry,
    getTerminalNameByAbbrev,
    currentVesselLocation,
    now: now ?? new Date(nowMs),
    theme,
  });
};
