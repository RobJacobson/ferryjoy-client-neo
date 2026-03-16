import { BlurView } from "expo-blur";
import type { ComponentRef, RefObject } from "react";
import { View, type ViewStyle } from "react-native";
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
  <View pointerEvents="none" className="absolute" style={getBadgeStyle(sizePx)}>
    <View className="overflow-hidden rounded-full border border-purple-400">
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
        style={getBadgeBodyStyle(sizePx)}
      >
        <Text className="font-playpen-600 text-purple-700">{label}</Text>
      </View>
    </View>
  </View>
);

const getBadgeStyle = (sizePx: number): ViewStyle => ({
  left: "50%",
  width: sizePx,
  height: sizePx,
  marginLeft: -sizePx / 2,
});

const getBadgeBodyStyle = (sizePx: number): ViewStyle => ({
  width: sizePx,
  height: sizePx,
});
