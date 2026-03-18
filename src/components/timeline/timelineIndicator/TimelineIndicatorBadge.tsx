import type { ComponentRef, RefObject } from "react";
import type { ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";
import { TimelineIndicatorGlass } from "./TimelineIndicatorGlass";

type TimelineIndicatorBadgeProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  label: string;
  sizePx: number;
};

export const TimelineIndicatorBadge = ({
  blurTargetRef,
  label,
  sizePx,
}: TimelineIndicatorBadgeProps) => (
  <TimelineIndicatorGlass
    blurTargetRef={blurTargetRef}
    className="absolute"
    style={getBadgeStyle(sizePx)}
    contentClassName="h-full w-full items-center justify-center"
  >
    <Text className="font-playpen-600 text-purple-700">{label}</Text>
  </TimelineIndicatorGlass>
);

const getBadgeStyle = (sizePx: number): ViewStyle => ({
  left: "50%",
  width: sizePx,
  height: sizePx,
  marginLeft: -sizePx / 2,
});
