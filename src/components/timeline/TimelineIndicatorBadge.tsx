import { BlurView } from "expo-blur";
import type { ComponentRef, RefObject } from "react";
import { View } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";
import { INDICATOR_STYLE } from "./theme";

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
    className={INDICATOR_STYLE.surfaceClassName}
    style={{
      width: sizePx,
      height: sizePx,
    }}
  >
    <BlurView
      blurTarget={blurTargetRef}
      intensity={INDICATOR_STYLE.blurIntensity}
      tint="light"
      blurMethod="dimezisBlurView"
      className={INDICATOR_STYLE.blurClassName}
    />
    <View className={INDICATOR_STYLE.overlayClassName} />
    <View
      className={INDICATOR_STYLE.contentClassName}
      style={{
        width: sizePx,
        height: sizePx,
      }}
    >
      <Text
        className={INDICATOR_STYLE.labelClassName}
        style={{ includeFontPadding: false }}
      >
        {label}
      </Text>
    </View>
  </View>
);
