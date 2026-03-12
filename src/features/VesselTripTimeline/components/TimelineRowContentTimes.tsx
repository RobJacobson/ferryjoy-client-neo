/**
 * Reusable time-events content for timeline row slots.
 * Displays start boundary times for a timeline segment.
 */

import { View } from "@/components/ui";
import type { TimePoint } from "../types";
import { TimelineEvent } from "./TimelineEvent";

type RowContentTimesProps = {
  startPoint: TimePoint;
};

type TimepointRowContentTimes = {
  point: TimePoint;
};

const TimelineRowContentTimes = ({ point }: TimepointRowContentTimes) => {
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
 * Renders start boundary times for a segment.
 *
 * @param startPoint - TimePoint for the segment's starting boundary
 * @returns Timeline events view with time components
 */
export const RowContentTimes = ({ startPoint }: RowContentTimesProps) => (
  <View className="mt-[-10px] flex-1 justify-start">
    <TimelineRowContentTimes point={startPoint} />
  </View>
);
