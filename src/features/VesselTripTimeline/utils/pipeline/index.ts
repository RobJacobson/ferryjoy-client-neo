/**
 * Vessel trip timeline pipeline: literal chain from item to render state.
 *
 * Stages:
 * 1. boundaries(item) → BoundaryData
 * 2. rows(boundaryData, item) → TimelineDocumentRow[]
 * 3. document(rowsWithGeometry, item) → TimelineDocument
 * 4. renderRows(document, now) → TimelineRenderRow[]
 * 5. renderState(document, renderRows, item, now) → TimelineRenderState
 */

import type { TimelineItem, TimelineRenderState } from "../../types";
import { getBoundaries } from "./boundaries";
import { getDocument as documentStage } from "./document";
import { renderRows } from "./renderRows";
import { renderState } from "./renderState";
import { getRows } from "./rows";

/**
 * Runs the pipeline and returns render-ready timeline state for the UI.
 *
 * @param item - Vessel trip and location pair
 * @param now - Current wall-clock time (defaults to new Date())
 * @returns TimelineRenderState for TimelineContent
 */
export const getTimelineRenderState = (
  item: TimelineItem,
  now: Date = new Date()
): TimelineRenderState => {
  const boundaryData = getBoundaries(item);
  const rowsWithGeometry = getRows(boundaryData, item);
  const doc = documentStage(rowsWithGeometry, item);
  const renderRowsOut = renderRows(doc, now);
  return renderState(doc, renderRowsOut, item, now);
};
