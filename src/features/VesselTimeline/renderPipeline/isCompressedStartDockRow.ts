/**
 * Detects the compressed overnight dock row at the start of the timeline.
 */

import { getSailingDay } from "@/shared/utils/getSailingDay";
import type { VesselTimelineRow } from "../types";

/**
 * Returns whether this row is the real-arrival dock interval that begins the
 * visible day and should be visually compressed.
 *
 * @param row - Derived feature row
 * @param rowIndex - Position in render order
 * @returns Whether the row is the compressed start-of-day dock row
 */
export const isCompressedStartDockRow = (
  row: VesselTimelineRow,
  rowIndex: number
) =>
  rowIndex === 0 &&
  row.kind === "at-dock" &&
  row.rowEdge === "normal" &&
  row.startEvent.IsArrivalPlaceholder !== true &&
  row.startEvent.EventType === "arv-dock" &&
  getSailingDay(row.startEvent.ScheduledDeparture) !==
    getSailingDay(row.endEvent.ScheduledDeparture);
