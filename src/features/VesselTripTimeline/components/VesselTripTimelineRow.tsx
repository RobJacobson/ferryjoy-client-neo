/**
 * Vessel-trip timeline row that renders label and times from a single start boundary.
 * Wraps the shared TimelineRowComponent; callers pass startBoundary instead of
 * leftContent/rightContent.
 */

import { TimelineRowComponent } from "@/components/Timeline";
import type { RequiredTimelineTheme } from "@/components/Timeline/TimelineTypes";
import type { TimelineRenderBoundary } from "../types";
import { RowContentLabel } from "./RowContentLabel";
import { RowContentTimes } from "./RowContentTimes";

type VesselTripTimelineRowProps = {
  id: string;
  durationMinutes: number;
  startBoundary: TimelineRenderBoundary;
  minHeight?: number;
  theme: RequiredTimelineTheme;
  isLastRow?: boolean;
  onRowLayout: (rowId: string, bounds: { y: number; height: number }) => void;
};

/**
 * Renders a timeline row with label and times derived from startBoundary.
 *
 * @param props - Row id, duration, start boundary, and layout props
 * @returns Timeline row view with left label and right times
 */
export const VesselTripTimelineRow = ({
  id,
  durationMinutes,
  startBoundary,
  minHeight,
  theme,
  isLastRow,
  onRowLayout,
}: VesselTripTimelineRowProps) => (
  <TimelineRowComponent
    id={id}
    durationMinutes={durationMinutes}
    minHeight={minHeight}
    theme={theme}
    isLastRow={isLastRow}
    onRowLayout={onRowLayout}
    leftContent={<RowContentLabel startLabel={startBoundary} />}
    rightContent={<RowContentTimes startPoint={startBoundary.timePoint} />}
  />
);
