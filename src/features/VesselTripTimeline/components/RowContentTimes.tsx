/**
 * Reusable time-events content for timeline row slots.
 * Displays scheduled, actual, and estimated times in priority order.
 * Can be positioned on either the left or right slot.
 */

import { View } from "@/components/ui";
import type { TimePoint } from "../types";
import { TimelineEvent } from "./TimelineEvent";

/**
 * Renders timeline events in priority order: actual (if present),
 * predicted (if no actual), and always scheduled (if present).
 *
 * @param props - TimePoint with scheduled, actual, estimated
 * @returns Timeline events view with time components
 */
export const RowContentTimes = ({
  scheduled,
  actual,
  estimated,
}: TimePoint) => (
  <View className="mt-[-10px] flex-row gap-1">
    {scheduled && <TimelineEvent time={scheduled} type="scheduled" />}
    {actual && <TimelineEvent time={actual} type="actual" />}
    {!actual && estimated && (
      <TimelineEvent time={estimated} type="estimated" />
    )}
  </View>
);
