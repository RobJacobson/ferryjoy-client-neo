/**
 * Shared animated timeline indicator.
 */

import { BlurView } from "expo-blur";
import type { RefObject } from "react";
import type { View as RNView } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Text } from "@/components/ui";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { INDICATOR_STYLE } from "./theme";
import { useAnimatedProgress } from "./useAnimatedProgress";

type TimelineIndicatorProps = {
  blurTargetRef: RefObject<RNView | null>;
  topPx: number;
  shouldJump?: boolean;
  label: string;
  sizePx?: number;
};

export const TimelineIndicator = ({
  blurTargetRef,
  topPx,
  shouldJump = false,
  label,
  sizePx = INDICATOR_STYLE.sizePx,
}: TimelineIndicatorProps) => {
  const progress = useAnimatedProgress(topPx, shouldJump);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      top: progress.value,
    };
  }, [progress]);

  return (
    <Animated.View
      className={INDICATOR_STYLE.containerClassName}
      style={[
        { left: "50%" },
        getAbsoluteCenteredBoxStyle({
          width: sizePx,
          height: sizePx,
        }),
        animatedStyle,
      ]}
    >
      <BlurView
        blurTarget={blurTargetRef}
        intensity={5}
        tint="light"
        blurMethod="dimezisBlurView"
        className={INDICATOR_STYLE.blurClassName}
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
      </BlurView>
    </Animated.View>
  );
};
