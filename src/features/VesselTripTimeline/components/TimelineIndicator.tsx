/**
 * Timeline indicator component with BlurView and optional label.
 * Position is animated with a Reanimated spring so infrequent data updates
 * (e.g. every 5s) produce smooth motion instead of abrupt jumps.
 */

import { BlurView } from "expo-blur";
import type { RefObject } from "react";
import type { View as RNView } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Text } from "@/components/ui";
import { useAnimatedProgress } from "../hooks/useAnimatedProgress";

type TimelineIndicatorProps = {
  blurTargetRef: RefObject<RNView | null>;
  positionPercent: number;
  label: string;
  sizePx?: number;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  borderColor?: string;
};

/**
 * Renders a timeline indicator with blur effect and label.
 * Vertical position is driven by a Reanimated SharedValue so updates
 * from deriveOverlayIndicator animate smoothly (spring) instead of jumping.
 *
 * @param blurTargetRef - Ref to the BlurTargetView for blur effect
 * @param positionPercent - Vertical position as fraction 0-1 (target; animated)
 * @param label - Label text displayed inside the indicator
 * @param sizePx - Diameter of the indicator in pixels
 * @param intensity - Blur intensity
 * @returns Timeline indicator view
 */
export const TimelineIndicator = ({
  blurTargetRef,
  positionPercent,
  label,
  sizePx = 36,
}: TimelineIndicatorProps) => {
  const progress = useAnimatedProgress(positionPercent);

  const animatedStyle = useAnimatedStyle(() => {
    const clamped = Math.min(1, Math.max(0, progress.value));
    return {
      top: `${clamped * 100}%`,
    };
  }, [progress]);

  return (
    <Animated.View
      className="absolute items-center justify-center rounded-full border border-green-500 bg-white/75"
      style={[
        {
          left: "50%",
          marginLeft: -sizePx / 2,
          marginTop: -sizePx / 2,
          width: sizePx,
          height: sizePx,
        },
        animatedStyle,
      ]}
    >
      <BlurView
        blurTarget={blurTargetRef}
        intensity={5}
        tint={"light"}
        blurMethod="dimezisBlurView"
        className="items-center justify-center overflow-hidden rounded-full border border-green-500 bg-white/50"
        style={{
          width: sizePx,
          height: sizePx,
        }}
      >
        <Text
          className="text-center font-bold text-green-700 text-xs"
          style={{ includeFontPadding: false }}
        >
          {label}
        </Text>
      </BlurView>
    </Animated.View>
  );
};
