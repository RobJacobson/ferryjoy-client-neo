/**
 * Timeline indicator component with BlurView and optional label.
 * Supports configurable position, size, intensity, and styling.
 */

import type { RefObject } from "react";
import type { View as RNView } from "react-native";
import { BlurView } from "@/components/BlurView";
import { Text, View } from "@/components/ui";

const BORDER_WIDTH = 2;

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
 *
 * @param blurTargetRef - Ref to the BlurTargetView for blur effect
 * @param positionPercent - Vertical position as fraction 0-1
 * @param label - Label text displayed inside the indicator
 * @param sizePx - Diameter of the indicator in pixels
 * @param intensity - Blur intensity
 * @param tint - Blur tint
 * @param borderColor - Border color for the indicator
 * @returns Timeline indicator view
 */
export const TimelineIndicator = ({
  blurTargetRef,
  positionPercent,
  label,
  sizePx = 36,
  intensity = 5,
  tint = "light",
  borderColor = "#22c55e",
}: TimelineIndicatorProps) => (
  <View
    className="absolute left-1/2"
    style={{
      top: `${positionPercent * 100}%`,
      marginLeft: -sizePx / 2,
      marginTop: -sizePx / 2,
    }}
  >
    <BlurView
      blurTarget={blurTargetRef}
      intensity={intensity}
      tint={tint}
      blurMethod="dimezisBlurView"
      className="items-center justify-center overflow-hidden"
      style={{
        width: sizePx,
        height: sizePx,
        borderRadius: sizePx / 2,
        borderWidth: BORDER_WIDTH,
        borderColor,
      }}
    >
      <View className="inset-0 items-center justify-center">
        <Text
          className="text-center font-bold text-green-700 text-xs"
          style={{ includeFontPadding: false }}
        >
          {label}
        </Text>
      </View>
    </BlurView>
  </View>
);
