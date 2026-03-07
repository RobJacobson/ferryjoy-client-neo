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
  topPx: number;
  shouldJump?: boolean;
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
 * @param topPx - Container-relative top position in pixels (target; animated)
 * @param shouldJump - Whether to snap immediately instead of springing
 * @param label - Label text displayed inside the indicator
 * @param sizePx - Diameter of the indicator in pixels
 * @param intensity - Blur intensity
 * @returns Timeline indicator view
 */
export const TimelineIndicator = ({
  blurTargetRef,
  topPx,
  shouldJump = false,
  label,
  sizePx = 36,
}: TimelineIndicatorProps) => {
  const progress = useAnimatedProgress(topPx, shouldJump);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      top: progress.value,
    };
  }, [progress]);

  return (
    <Animated.View
      className="items-center justify-center rounded-full border border-green-500 bg-white/75"
      style={[
        {
          position: "absolute",
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
