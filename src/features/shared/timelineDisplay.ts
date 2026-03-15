import type { TimelineRenderBoundary as SharedTimelineRenderBoundary } from "@/components/timeline";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";

type TimelineBoundaryWithDisplayData = {
  label: string;
  terminalAbbrev?: string;
  timePoint: SharedTimelineRenderBoundary["timePoint"];
};

export const toSharedTimelineBoundary = (
  boundary: TimelineBoundaryWithDisplayData
): SharedTimelineRenderBoundary => ({
  label: getDisplayEventLabel(boundary.label),
  title:
    boundary.label === "Arv"
      ? getDisplayTerminalName(boundary.terminalAbbrev)
      : undefined,
  timePoint: boundary.timePoint,
});

const getDisplayEventLabel = (label: string) =>
  label === "Arv" ? "Arriving" : label === "Dep" ? "Departing" : label;

const getDisplayTerminalName = (terminalAbbrev?: string) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  return terminalName
    ?.replace("Island", "Is.")
    .replace("Port", "Pt.")
    .replace("Point", "Pt.");
};
