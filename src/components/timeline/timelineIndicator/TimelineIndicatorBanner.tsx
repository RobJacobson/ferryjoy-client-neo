import type { ComponentRef, RefObject } from "react";
import { View, type ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";
import { TimelineIndicatorGlass } from "./TimelineIndicatorGlass";

type TimelineIndicatorBannerProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  title?: string;
  subtitle?: string;
  sizePx: number;
};

export const TimelineIndicatorBanner = ({
  blurTargetRef,
  title,
  subtitle,
  sizePx,
}: TimelineIndicatorBannerProps) => {
  if (!title && !subtitle) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute items-center"
      style={getBannerStyle(sizePx)}
    >
      <TimelineIndicatorGlass
        blurTargetRef={blurTargetRef}
        contentClassName="items-center px-4 py-1"
      >
        {title ? (
          <Text className="text-center font-playpen-600 text-purple-800 leading-tight">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text className="text-center font-playpen-300 text-purple-800 text-sm leading-tight">
            {subtitle}
          </Text>
        ) : null}
      </TimelineIndicatorGlass>
    </View>
  );
};

const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx - 6,
  left: "50%",
  width: 200,
  marginLeft: -100,
});
