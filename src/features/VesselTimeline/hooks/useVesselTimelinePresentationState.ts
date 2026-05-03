/**
 * Presentation-state hook for the VesselTimeline feature.
 */

import type { TimelineVisualTheme } from "@/components/timeline";
import {
  useConvexVesselLocations,
  useConvexVesselTimelineEvents,
} from "@/data/contexts";
import { useTerminalsData } from "@/data/contexts/identity/TerminalsDataContext";
import { useNowMs } from "@/shared/hooks";
import { buildEventRowTimelinePresentationState } from "./presentationStateBuilders";

/**
 * Builds screen-level VesselTimeline presentation state from vessel-day event
 * rows plus feature-owned render-state adaptation.
 *
 * @param args - Hook inputs
 * @param args.now - Optional wall-clock override for deterministic rendering
 * @param args.theme - Resolved visual theme for timeline rendering
 * @returns Plain screen state for loading, error, empty, and ready branches
 */
const useVesselTimelinePresentationState = ({
  now,
  theme,
}: {
  now?: Date;
  theme: TimelineVisualTheme;
}): ReturnType<typeof buildEventRowTimelinePresentationState> => {
  const nowMs = useNowMs(1000);
  const terminalsData = useTerminalsData();
  const { vesselLocations } = useConvexVesselLocations();
  const events = useConvexVesselTimelineEvents();

  const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
    terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()]
      ?.TerminalName ?? null;
  const currentVesselLocation =
    vesselLocations.find(
      (location) => location.VesselAbbrev === events.vesselAbbrev
    ) ?? null;

  return buildEventRowTimelinePresentationState({
    events,
    getTerminalNameByAbbrev,
    currentVesselLocation,
    now: now ?? new Date(nowMs),
    theme,
  });
};

export { useVesselTimelinePresentationState };
