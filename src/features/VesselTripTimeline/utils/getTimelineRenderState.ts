/**
 * Single entry point for vessel trip timeline render state.
 *
 * Builds the canonical document and derives render-ready rows and active
 * indicator. The document is the internal source of truth; callers receive
 * only the render state needed for the UI.
 */

import type { TimelineItem, TimelineRenderState } from "../types";
import { buildTimelineDocument } from "./buildTimelineDocument";
import { selectTimelineRenderState } from "./selectTimelineRenderState";

/**
 * Returns render-ready timeline state for a vessel trip.
 *
 * @param item - Vessel trip and location pair
 * @param now - Current wall-clock time (defaults to new Date())
 * @returns Rows and active indicator for TimelineContent
 */
export const getTimelineRenderState = (
  item: TimelineItem,
  now: Date = new Date()
): TimelineRenderState => {
  const document = buildTimelineDocument(item);
  return selectTimelineRenderState(document, item, now);
};
