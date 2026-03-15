import { BlurView } from "expo-blur";
import type { ComponentRef, RefObject } from "react";
import { View, type ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";

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
      <View className="overflow-hidden rounded-full border border-purple-400">
        <BlurView
          blurTarget={blurTargetRef}
          intensity={8}
          tint="light"
          blurMethod="dimezisBlurView"
          className="absolute inset-0"
        />
        <View className="absolute inset-0 bg-white/50" />
        <View className="items-center px-4 py-1">
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
        </View>
      </View>
    </View>
  );
};

const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx - 6,
  left: "50%",
  width: 200,
  marginLeft: -100,
});
