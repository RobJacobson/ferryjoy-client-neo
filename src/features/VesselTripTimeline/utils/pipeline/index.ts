/**
 * Vessel trip timeline pipeline: literal chain from input to final render state.
 */

import type {
  TimelineItem,
  TimelinePipelineInput,
  TimelineRenderState,
} from "../../types";
import { toActiveIndicator } from "./toActiveIndicator";
import { toActiveRow } from "./toActiveRow";
import { toDerivedRows } from "./toDerivedRows";
import { toRenderRows } from "./toRenderRows";
import { toTimelineEvents } from "./toTimelineEvents";
import { toTimelineRenderState } from "./toTimelineRenderState";

/**
 * Runs the pipeline and returns render-ready timeline state for the UI.
 *
 * @param item - Vessel trip and location pair
 * @param now - Current wall-clock time (defaults to new Date())
 * @returns TimelineRenderState for TimelineContent
 */
export const getTimelineRenderState = (
  item: TimelineItem,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null,
  now: Date = new Date()
): TimelineRenderState => {
  const input = {
    item,
    getTerminalNameByAbbrev,
    now,
  } satisfies TimelinePipelineInput;
  const withEvents = toTimelineEvents(input);
  const withRows = toDerivedRows(withEvents);
  const withActiveRow = toActiveRow(withRows);
  const withRenderRows = toRenderRows(withActiveRow);
  const withActiveIndicator = toActiveIndicator(withRenderRows);

  return toTimelineRenderState(withActiveIndicator);
};
