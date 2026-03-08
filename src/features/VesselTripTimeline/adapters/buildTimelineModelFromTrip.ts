/**
 * Builds a pure timeline data model from vessel trip domain data.
 * This module intentionally contains no JSX so timeline business logic can be
 * read/tested independently from rendering concerns.
 */

import type {
  TimelineItem,
  TimelinePresentationModel,
  TimelineRowModel,
} from "../types";
import { buildTimelineSegments } from "../utils/buildTimelineSegments";
import { getSegmentDurationMinutes } from "../utils/timePoints";

/**
 * Builds a timeline data model for a single vessel trip card.
 * Produces an ordered sequence of presentation rows from canonical segments.
 *
 * @param item - Vessel trip and location pair
 * @returns Pure timeline model rows for timeline rendering
 */
export const buildTimelineModelFromTrip = (
  item: TimelineItem
): TimelinePresentationModel => {
  const { vesselLocation } = item;
  const useDistanceProgress =
    vesselLocation.DepartingDistance !== undefined &&
    vesselLocation.ArrivingDistance !== undefined &&
    vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0;
  const { segments, activeSegmentIndex } = buildTimelineSegments(item);

  const rows: TimelineRowModel[] = segments.map((segment) => ({
    ...segment,
    durationMinutes: getSegmentDurationMinutes(segment),
    useDistanceProgress:
      segment.kind === "at-sea" ? useDistanceProgress : false,
    minHeight: segment.rendersEndLabel ? 0 : undefined,
  }));

  return {
    rows,
    activeSegmentIndex,
  };
};
