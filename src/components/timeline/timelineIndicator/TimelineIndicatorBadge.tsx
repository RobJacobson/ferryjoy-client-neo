import type { ComponentRef, RefObject } from "react";
import { View, type ViewStyle } from "react-native";
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
  <View pointerEvents="none" className="absolute" style={getBadgeStyle(sizePx)}>
    <TimelineIndicatorGlass
      blurTargetRef={blurTargetRef}
      contentClassName="h-full w-full items-center justify-center"
    >
      <Text className="font-playpen-600 text-purple-700">{label}</Text>
    </TimelineIndicatorGlass>
  </View>
);

const getBadgeStyle = (sizePx: number): ViewStyle => ({
  left: "50%",
  width: sizePx,
  height: sizePx,
  marginLeft: -sizePx / 2,
});
