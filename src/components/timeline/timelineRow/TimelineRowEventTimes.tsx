/**
 * Right column: one or more time rows (scheduled plus actual or estimated).
 *
 * Each row stacks a stroked icon silhouette with the tinted icon and outlined
 * time text for legibility on busy backgrounds.
 */

import {
  CalendarClock,
  EqualApproximately,
  type LucideIcon,
  Timer,
} from "lucide-react-native";
import { StrokeText } from "@/components/StrokeText";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import { TIMELINE_ROW_CONFIG } from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineTimePoint } from "../types";

const EVENT_TIME_TEXT_STYLE = {
  fontFamily: "BitcountPropSingle-500",
  fontSize: TIMELINE_ROW_CONFIG.times.textFontSizePx,
} as const;
const eventTypeIcons = {
  actual: Timer,
  scheduled: CalendarClock,
  estimated: EqualApproximately,
} as const;

type TimelineRowEventTimesProps = {
  point: TimelineTimePoint;
  showPlaceholder?: boolean;
  theme: TimelineVisualTheme;
};

type TimelineTimeEntry = {
  Icon: LucideIcon;
  label: string;
  rowClassName?: string;
};

type TimelineTimeColumns = {
  scheduled?: TimelineTimeEntry;
  secondary?: TimelineTimeEntry;
};

/**
 * Builds icon rows from schedule-first display rules and optional placeholder.
 *
 * @param point - Scheduled, actual, and estimated instants for the event
 * @param showPlaceholder - When true and no times exist, shows a placeholder row
 * @param theme - Body text color for the time rows
 * @returns Horizontal group of time rows
 */
export const TimelineRowEventTimes = ({
  point,
  showPlaceholder = false,
  theme,
}: TimelineRowEventTimesProps) => {
  const { scheduled, actual, estimated } = point;
  const secondary = actual ?? estimated;
  const columns = getTimeColumns({
    scheduled,
    secondary,
    secondaryIcon: eventTypeIcons[actual ? "actual" : "estimated"],
    showPlaceholder,
  });

  return (
    <View className="w-full flex-row items-start">
      <TimelineRowTimeColumn entry={columns.scheduled} theme={theme} />
      <TimelineRowTimeColumn entry={columns.secondary} theme={theme} />
    </View>
  );
};

type TimelineRowTimeColumnProps = {
  entry?: TimelineTimeEntry;
  theme: TimelineVisualTheme;
};

const TimelineRowTimeColumn = ({
  entry,
  theme,
}: TimelineRowTimeColumnProps) => (
  <View className="w-1/2 items-start">
    {entry ? (
      <TimelineRowEventTime
        Icon={entry.Icon}
        label={entry.label}
        rowClassName={entry.rowClassName}
        theme={theme}
      />
    ) : null}
  </View>
);

type TimelineRowEventTimeProps = {
  Icon: LucideIcon;
  label: string;
  rowClassName?: string;
  theme: TimelineVisualTheme;
};

/**
 * One outlined icon beside an outlined time string.
 *
 * @param Icon - Lucide icon for this row's time kind
 * @param label - Formatted time or placeholder text
 * @param rowClassName - Optional flex gap between icon and label
 * @param theme - Body text color
 * @returns A single time row view
 */
const TimelineRowEventTime = ({
  Icon,
  label,
  rowClassName,
  theme,
}: TimelineRowEventTimeProps) => (
  <View className={cn("mt-[-1px] flex-row items-center", rowClassName)}>
    <TimelineOutlinedIcon
      Icon={Icon}
      color={theme.text.bodyColor}
      outlineColor={theme.outlines.color}
    />
    <View>
      <StrokeText
        outlineColor={theme.outlines.color}
        style={[EVENT_TIME_TEXT_STYLE, { color: theme.text.bodyColor }]}
      >
        {label}
      </StrokeText>
    </View>
  </View>
);

type TimelineOutlinedIconProps = {
  Icon: LucideIcon;
  color: string;
  outlineColor: string;
};

/**
 * Draws the icon twice to create a simple outline behind the tinted glyph.
 *
 * @param Icon - Lucide icon to render
 * @param color - Foreground icon color
 * @param outlineColor - HSLA outline color behind the icon
 * @returns Outlined icon view
 */
const TimelineOutlinedIcon = ({
  Icon,
  color,
  outlineColor,
}: TimelineOutlinedIconProps) => (
  <View className="relative">
    <View className="absolute top-0 left-0">
      <Icon
        size={TIMELINE_ROW_CONFIG.times.iconSizePx}
        strokeWidth={
          TIMELINE_ROW_CONFIG.times.iconStrokeWidth +
          TIMELINE_ROW_CONFIG.times.iconOutlineWidth * 2
        }
        color={outlineColor}
      />
    </View>
    <Icon
      size={TIMELINE_ROW_CONFIG.times.iconSizePx}
      strokeWidth={TIMELINE_ROW_CONFIG.times.iconStrokeWidth}
      color={color}
    />
  </View>
);

/**
 * Produces stable scheduled and secondary time columns.
 *
 * @param scheduled - Baseline scheduled instant, if any
 * @param secondary - Actual if set, else estimated, when present
 * @param secondaryIcon - Icon matching actual vs estimated for the secondary row
 * @param showPlaceholder - Enables `--` placeholder when no times exist
 * @returns Per-column entries rendered as `TimelineRowEventTime` rows
 */
const getTimeColumns = ({
  scheduled,
  secondary,
  secondaryIcon,
  showPlaceholder,
}: {
  scheduled?: Date;
  secondary?: Date;
  secondaryIcon: LucideIcon;
  showPlaceholder: boolean;
}): TimelineTimeColumns => {
  const columns: TimelineTimeColumns = {};

  if (!scheduled && showPlaceholder) {
    columns.scheduled = {
      Icon: CalendarClock,
      label: "--",
      rowClassName: "gap-2",
    };
  }

  if (scheduled) {
    columns.scheduled = {
      Icon: eventTypeIcons.scheduled,
      label: toDisplayTime(scheduled),
      rowClassName: "gap-0.5",
    };
  }

  if (secondary) {
    columns.secondary = {
      Icon: secondaryIcon,
      label: toDisplayTime(secondary),
      rowClassName: "gap-0.5",
    };
  }

  return columns;
};
