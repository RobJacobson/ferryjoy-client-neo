/**
 * Reusable time-events content for timeline row slots.
 * Displays start and optional end boundary times for a timeline segment.
 */

import { View } from "@/components/ui";
import type { TimePoint } from "../types";
import { TimelineEvent } from "./TimelineEvent";

type RowContentTimesProps = {
  startPoint: TimePoint;
  endPoint?: TimePoint;
};

/**
 * Renders top and optional bottom boundary times for a segment.
 *
 * @param startPoint - TimePoint for the segment's starting boundary
 * @param endPoint - Optional TimePoint for the segment's ending boundary
 * @returns Timeline events view with time components
 */
export const RowContentTimes = ({
  startPoint,
  endPoint,
}: RowContentTimesProps) => (
  <View className="mt-[-10px] flex-1 justify-between">
    <TimePointEvents {...startPoint} />
    {endPoint ? <TimePointEvents {...endPoint} /> : null}
  </View>
);

/**
 * Renders timeline events in priority order for a single boundary point.
 *
 * @param props - TimePoint with scheduled, actual, and estimated values
 * @returns Timeline event chips for one boundary point
 */
const TimePointEvents = ({ scheduled, actual, estimated }: TimePoint) => (
  <View className="flex-row gap-1">
    {scheduled && <TimelineEvent time={scheduled} type="scheduled" />}
    {actual && <TimelineEvent time={actual} type="actual" />}
    {!actual && estimated && (
      <TimelineEvent time={estimated} type="estimated" />
    )}
  </View>
);
