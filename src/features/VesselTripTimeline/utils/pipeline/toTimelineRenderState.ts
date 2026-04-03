/**
 * Pipeline stage: return the final public render-state payload.
 */

import type {
  TimelinePipelineWithActiveIndicator,
  TimelineRenderState,
} from "../../types";

/**
 * Converts the enriched pipeline context into final render state.
 *
 * @param input - Pipeline context containing render rows and active indicator
 * @returns Final render state consumed by the trip timeline UI
 */
export const toTimelineRenderState = ({
  renderRows,
  activeIndicator,
}: TimelinePipelineWithActiveIndicator): TimelineRenderState => ({
  rows: renderRows,
  activeIndicator,
});
