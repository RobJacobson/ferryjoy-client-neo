/**
 * Generic timeline events component that displays actual, predicted,
 * and scheduled times in priority order.
 */

import { View } from "@/components/ui";
import { TimelineEvent } from "./TimelineEvent";

type TimelineEventsProps = {
  actualTime?: Date;
  predictedTime?: Date;
  scheduledTime?: Date;
};

/**
 * Renders timeline events in priority order: actual (if present),
 * predicted (if no actual), and always scheduled (if present).
 *
 * @param actualTime - Actual event time
 * @param predictedTime - Predicted event time (shown only if no actual)
 * @param scheduledTime - Scheduled event time
 * @returns Timeline events view with time components
 */
export const TimelineEvents = ({
  actualTime,
  predictedTime,
  scheduledTime,
}: TimelineEventsProps) => (
  <View className="mt-[-10px] flex-row gap-1">
    {scheduledTime && <TimelineEvent time={scheduledTime} type="scheduled" />}
    {actualTime && <TimelineEvent time={actualTime} type="actual" />}
    {!actualTime && predictedTime && (
      <TimelineEvent time={predictedTime} type="estimated" />
    )}
  </View>
);
