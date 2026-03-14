import { BlurView } from "expo-blur";
import type { ComponentRef, RefObject } from "react";
import { View } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";

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
  <View
    className="overflow-hidden rounded-full border border-green-500"
    style={{
      width: sizePx,
      height: sizePx,
    }}
  >
    <BlurView
      blurTarget={blurTargetRef}
      intensity={8}
      tint="light"
      blurMethod="dimezisBlurView"
      className="absolute inset-0"
    />
    <View className="absolute inset-0 bg-white/60" />
    <View
      className="items-center justify-center"
      style={{
        width: sizePx,
        height: sizePx,
      }}
    >
      <Text
        className="text-center font-bold text-purple-800 text-sm"
        style={{ includeFontPadding: false }}
      >
        {label}
      </Text>
    </View>
  </View>
);
