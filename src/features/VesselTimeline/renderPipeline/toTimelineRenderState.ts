/**
 * Pipeline stage: assemble the final public VesselTimeline render state.
 */

import type { VesselTimelineRenderState } from "../types";
import type { VesselTimelinePipelineWithActiveIndicator } from "./pipelineTypes";

/**
 * Converts the enriched pipeline context into the final public render state.
 *
 * @param input - Pipeline context containing renderer rows and active indicator
 * @returns Final render state consumed by `VesselTimelineContent`
 */
export const toTimelineRenderState = ({
  renderRows,
  rowLayouts,
  terminalCards,
  contentHeightPx,
  activeRowIndex,
  layout,
  theme,
  activeIndicator,
}: VesselTimelinePipelineWithActiveIndicator): VesselTimelineRenderState => ({
  rows: renderRows,
  rowLayouts,
  terminalCards,
  contentHeightPx,
  activeRowIndex,
  layout,
  theme,
  activeIndicator,
});
