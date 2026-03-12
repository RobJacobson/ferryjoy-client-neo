/**
 * Feature-level row content for the vessel trip timeline.
 * Renders left label, center marker, and right times for a single row.
 */

import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { Text } from "@/components/ui";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { ROW_STYLE } from "../theme";
import type {
  TimelineRenderBoundary,
  TimelineRenderRow,
  TimePoint,
} from "../types";
import { TimelineEvent } from "./TimelineEvent";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
  markerContent?: ReactNode;
};

/**
 * Renders the full left/center/right content for a single timeline row.
 *
 * @param props - Render row plus optional inner marker content
 * @returns Row content view
 */
export const TimelineRowContent = ({
  row,
  markerContent,
}: TimelineRowContentProps) => (
  <View className="w-full flex-row items-stretch">
    <View className="flex-1 justify-start">
      <StartBoundaryLabel label={row.startBoundary} />
    </View>

    <CenterMarker>{markerContent}</CenterMarker>

    <View className="flex-1 justify-start">
      <StartBoundaryTimes startPoint={row.startBoundary.timePoint} />
    </View>
  </View>
);

type BoundaryLabelProps = {
  label?: TimelineRenderBoundary;
};

/**
 * Renders the start boundary label for a segment.
 *
 * @param label - Start boundary render label when present
 * @returns Label view
 */
const StartBoundaryLabel = ({ label }: BoundaryLabelProps) => {
  if (!label?.terminalAbbrev) {
    return null;
  }

  const terminalName = getTerminalNameByAbbrev(label.terminalAbbrev);
  const displayName = terminalName
    ?.replace("Island", "Is.")
    .replace("Port", "Pt.")
    .replace("Point", "Pt.");

  return (
    <View className="mt-[-12px] flex flex-row items-center">
      <Text className="w-[36px] font-bitcount-400 text-gray-400 text-lg">
        {label.label}
      </Text>
      <Text className="font-bitcount-400 text-lg">{displayName}</Text>
    </View>
  );
};

type StartBoundaryTimesProps = {
  startPoint: TimePoint;
};

type TimepointRowContentTimesProps = {
  point: TimePoint;
};

const StartBoundaryTimesRow = ({ point }: TimepointRowContentTimesProps) => {
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
const StartBoundaryTimes = ({ startPoint }: StartBoundaryTimesProps) => (
  <View className="mt-[-10px] flex-1 justify-start">
    <StartBoundaryTimesRow point={startPoint} />
  </View>
);

type CenterMarkerProps = {
  children?: ReactNode;
};

/**
 * Renders the static center marker using the row style axis and marker size.
 *
 * @param children - Optional inner marker content
 * @returns Marker column view
 */
const CenterMarker = ({ children }: CenterMarkerProps) => (
  <View
    className="relative justify-start"
    style={{ width: ROW_STYLE.centerAxisSizePx }}
  >
    <View className="absolute" style={getMarkerStyle(ROW_STYLE.markerSizePx)}>
      <View
        className={cn(
          "items-center justify-center rounded-full",
          ROW_STYLE.markerClassName
        )}
        style={{
          width: ROW_STYLE.markerSizePx,
          height: ROW_STYLE.markerSizePx,
        }}
      >
        {children}
      </View>
    </View>
  </View>
);

const getMarkerStyle = (markerSizePx: number): ViewStyle => ({
  zIndex: 1,
  ...getAbsoluteCenteredBoxStyle({
    width: markerSizePx,
    height: markerSizePx,
    isVertical: true,
  }),
});
