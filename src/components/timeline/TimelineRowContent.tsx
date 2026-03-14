/**
 * Shared row content for the vertical timeline renderer.
 */

import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { Text } from "@/components/ui";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TimelineEvent } from "./TimelineEvent";
import { TimelineMarkerIcon } from "./TimelineMarkerIcon";
import { ROW_STYLE } from "./theme";
import type {
  TimelineRenderBoundary,
  TimelineRenderRow,
  TimelineTimePoint,
} from "./types";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
  markerContent?: ReactNode;
};

export const TimelineRowContent = ({
  row,
  markerContent,
}: TimelineRowContentProps) => (
  <View className="w-full flex-row items-stretch">
    <View className="flex-1 justify-start">
      <StartBoundaryLabel label={row.startBoundary} />
    </View>

    <CenterMarker row={row}>
      {markerContent ?? (
        <TimelineMarkerIcon kind={row.kind} appearance={row.markerAppearance} />
      )}
    </CenterMarker>

    <View className="flex-1 justify-start">
      <StartBoundaryTimes startPoint={row.startBoundary.timePoint} />
    </View>
  </View>
);

type BoundaryLabelProps = {
  label?: TimelineRenderBoundary;
};

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
  startPoint: TimelineTimePoint;
};

type TimepointRowContentTimesProps = {
  point: TimelineTimePoint;
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

const StartBoundaryTimes = ({ startPoint }: StartBoundaryTimesProps) => (
  <View className="mt-[-10px] flex-1 justify-start">
    <StartBoundaryTimesRow point={startPoint} />
  </View>
);

type CenterMarkerProps = {
  row: TimelineRenderRow;
  children?: ReactNode;
};

const CenterMarker = ({ row, children }: CenterMarkerProps) => (
  <View
    className="relative justify-start"
    style={{ width: ROW_STYLE.centerAxisSizePx }}
  >
    <View className="absolute" style={getMarkerStyle(ROW_STYLE.markerSizePx)}>
      <View
        className={cn(
          "items-center justify-center overflow-hidden rounded-full",
          ROW_STYLE.markerAppearance[row.markerAppearance].containerClassName
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
