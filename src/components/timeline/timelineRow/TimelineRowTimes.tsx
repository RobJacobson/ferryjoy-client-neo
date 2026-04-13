/**
 * Two half-width columns: scheduled time (left) and actual or estimated (right).
 *
 * Small helpers pick icon kind and instant per column so branching stays local.
 */

import { View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineTimePoint } from "../types";
import { TimelineRowTime, type TimelineTimeIconKind } from "./TimelineRowTime";

type TimelineTimeEntry = {
  kind: TimelineTimeIconKind;
  time: Date | undefined;
};

type TimelineRowTimesProps = {
  point: TimelineTimePoint;
  showPlaceholder?: boolean;
  theme: TimelineVisualTheme;
};

/**
 * Renders scheduled and actual/estimated times with per-kind icons.
 *
 * @param point - Scheduled, actual, and estimated instants for the event
 * @param showPlaceholder - When secondary has no times, show `--` with icon
 * @param theme - Text and icon colors for the time rows
 * @returns Horizontal group of up to two time rows
 */
const TimelineRowTimes = ({
  point,
  showPlaceholder = false,
  theme,
}: TimelineRowTimesProps) => {
  const { scheduled, actual, estimated } = point;
  const scheduledEntry = scheduledTimeEntry(scheduled);
  const secondaryEntry = secondaryTimeEntry(actual, estimated, showPlaceholder);

  return (
    <View className="w-full flex-row items-start">
      <View className="w-1/2 items-start">
        <TimelineRowTime
          kind={scheduledEntry.kind}
          at={scheduledEntry.time}
          theme={theme}
        />
      </View>
      <View className="w-1/2 items-start">
        {secondaryEntry ? (
          <TimelineRowTime
            kind={secondaryEntry.kind}
            at={secondaryEntry.time}
            theme={theme}
          />
        ) : null}
      </View>
    </View>
  );
};

/**
 * Left column always shows the scheduled row: clock or `--` when missing.
 *
 * @param scheduled - Baseline scheduled instant, if any
 * @returns Icon kind and time for the scheduled slot
 */
const scheduledTimeEntry = (
  scheduled: Date | undefined
): TimelineTimeEntry => ({
  kind: "scheduled",
  time: scheduled,
});

/**
 * Right column: actual if present, else estimated; optional `--` placeholder
 * uses the actual icon when both are absent.
 *
 * @param actual - Observed time when known
 * @param estimated - Predicted time when actual is absent
 * @param showPlaceholder - When true and no times, show actual icon + `--`
 * @returns Entry for the right slot, or undefined when empty and no placeholder
 */
const secondaryTimeEntry = (
  actual: Date | undefined,
  estimated: Date | undefined,
  showPlaceholder: boolean
): TimelineTimeEntry | undefined =>
  actual
    ? { kind: "actual", time: actual }
    : estimated
      ? { kind: "estimated", time: estimated }
      : showPlaceholder
        ? { kind: "actual", time: undefined }
        : undefined;

export { TimelineRowTimes };
