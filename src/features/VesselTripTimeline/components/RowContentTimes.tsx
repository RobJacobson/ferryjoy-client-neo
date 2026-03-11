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

type TimepointTimesProps = {
  point: TimePoint;
};

const TimepointTimes = ({ point }: TimepointTimesProps) => {
  const { scheduled, actual, estimated } = point;
  const secondary = actual ?? estimated;

  return (
    <View className="flex-row gap-1">
      {scheduled && <TimelineEvent time={scheduled} type="scheduled" />}
      {secondary && (
        <TimelineEvent
          time={secondary}
          type={actual ? "actual" : "estimated"}
        />
      )}
    </View>
  );
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
    <TimepointTimes point={startPoint} />
    {endPoint ? <TimepointTimes point={endPoint} /> : null}
  </View>
);
