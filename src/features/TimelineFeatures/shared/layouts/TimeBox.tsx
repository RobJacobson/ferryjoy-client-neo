/**
 * TimeBox provides a compact time display with label and times.
 * Reuses common pattern: label + scheduled time + actual/estimated time.
 * Use with StandardMarkerLayout for flexible positioning.
 */

import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import TimelineMarkerLabel from "../TimelineMarkerLabel";
import TimelineMarkerTime from "../TimelineMarkerTime";

type TimeBoxProps = {
  /**
   * Label text to display (e.g., "Arrive SEA", "Left ABC").
   */
  label: string;
  /**
   * Scheduled time for this event.
   */
  scheduled: Date;
  /**
   * Actual arrival/departure time (if available).
   */
  actual?: Date;
  /**
   * Estimated arrival/departure time (if actual is not available).
   */
  estimated?: Date;
  /**
   * When true, renders times above the label instead of below.
   * Default is false (label on top, times below).
   */
  timesAbove?: boolean;
  /**
   * Optional className for additional styling on the TimeBox container.
   * Merged with default flex-col layout.
   */
  className?: string;
};

/**
 * A compact time display component showing label and times in a vertical stack.
 * Default layout: label on top, scheduled time in middle, actual/estimated time below.
 *
 * @param label - Label text to display
 * @param scheduled - Scheduled time
 * @param actual - Optional actual time
 * @param estimated - Optional estimated time (used if actual is not provided)
 * @param timesAbove - When true, puts times above the label (default false)
 * @param className - Optional className for additional styling on the container
 * @returns A View component with label and times
 */
export const TimeBox = ({
  label,
  scheduled,
  actual,
  estimated,
  timesAbove = false,
  className,
}: TimeBoxProps) => {
  const timeContent = (
    <>
      <TimelineMarkerTime time={scheduled} type="scheduled" isBold />
      <TimelineMarkerTime
        time={actual ?? estimated}
        type={actual ? "actual" : "estimated"}
      />
    </>
  );

  const labelContent = <TimelineMarkerLabel text={label} />;

  return (
    <View
      className={cn("flex-col items-center justify-center pt-2", className)}
    >
      {timesAbove ? (
        <>
          {timeContent}
          {labelContent}
        </>
      ) : (
        <>
          {labelContent}
          {timeContent}
        </>
      )}
    </View>
  );
};

export default TimeBox;
