/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments (departure → stops → destination).
 * Renders from pipeline-produced legProps only (no context lookup).
 */

import { View } from "react-native";
import { ScheduledTripLeg } from "./ScheduledTripLeg";
import type { Segment } from "./types";
import type { SegmentLegProps } from "./utils/scheduledTripsPipeline";

type ScheduledTripTimelineProps = {
  segments: Segment[];
  /** Pre-computed leg props from pipeline (one per segment). Required. */
  legProps: SegmentLegProps[];
};

/**
 * Displays a multi-segment timeline for scheduled ferry trips from pipeline leg props.
 * Renders one ScheduledTripLeg per segment; no context lookup—all data comes from legProps.
 *
 * @param segments - Ordered segments for this journey (for structure only; legProps carry data)
 * @param legProps - Pre-computed leg props from pipeline, one per segment; required
 * @returns View of horizontal timeline or null when segments/legProps empty
 */
export const ScheduledTripTimeline = ({
  segments,
  legProps,
}: ScheduledTripTimelineProps) => {
  if (segments.length === 0 || legProps.length === 0) return null;

  return (
    <View className="relative flex-row items-center justify-between w-full overflow-visible px-4 py-8">
      {legProps.map((props) => (
        <ScheduledTripLeg key={props.segment.Key} {...props} />
      ))}
    </View>
  );
};
