/**
 * TripProgressIndicator component for rendering a progress indicator overlay
 * that displays minutes remaining in a circular badge.
 */

import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { shadowStyle } from "./config";

// ============================================================================
// Types
// ============================================================================

type TripProgressIndicatorProps = {
  /**
   * Progress value (0-1) for horizontal positioning within the parent bar.
   */
  progress: number;
  /**
   * Minutes remaining to display in the indicator.
   */
  minutesRemaining: number;
  /**
   * Optional z-index for stacking order.
   */
  zIndex?: number;
  /**
   * Optional label text to display above the indicator.
   */
  labelAbove?: string;
};

// ============================================================================
// Component
// ============================================================================

const INDICATOR_SIZE = 32;

/**
 * Renders a progress indicator positioned based on progress value within the parent bar.
 * The indicator is absolutely positioned and displays the minutes remaining.
 * Optionally displays a label above the indicator when labelAbove is provided.
 *
 * @param progress - Progress value (0-1) for horizontal positioning
 * @param minutesRemaining - Minutes remaining to display
 * @param zIndex - Optional z-index for stacking order
 * @param labelAbove - Optional label text to display above the indicator
 * @returns A View component containing the indicator and optional label
 */
const TripProgressIndicator = ({
  progress,
  minutesRemaining,
  zIndex,
  labelAbove,
}: TripProgressIndicatorProps) => {
  const [labelWidth, setLabelWidth] = useState(0);

  const handleLabelLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setLabelWidth((prev) => (prev === width ? prev : width));
  };

  return (
    <View
      className="absolute"
      pointerEvents="none"
      style={{
        top: "50%",
        left: `${progress * 100}%`,
        transform: [
          { translateX: -INDICATOR_SIZE / 2 },
          { translateY: -INDICATOR_SIZE / 2 },
        ],
        zIndex,
        elevation: zIndex ?? shadowStyle.elevation,
        overflow: "visible",
      }}
    >
      {/* Label above indicator */}
      {labelAbove && (
        <View
          className="absolute"
          pointerEvents="none"
          style={{
            bottom: INDICATOR_SIZE / 2 + 20,
            left: INDICATOR_SIZE / 2,
            transform: [{ translateX: -labelWidth / 2 }],
            overflow: "visible",
            width: labelWidth > 0 ? labelWidth : 1000,
          }}
          onLayout={handleLabelLayout}
        >
          <Text
            className="text-sm leading-tight font-semibold text-center text-pink-500"
            style={{
              width: "100%",
            }}
          >
            {labelAbove}
          </Text>
        </View>
      )}

      {/* Indicator circle */}
      <View
        className="rounded-full items-center justify-center border-2 bg-pink-50 border-pink-500"
        style={{
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          ...shadowStyle,
        }}
      >
        <View className="w-full items-center justify-center">
          <Text className="text-sm font-bold text-pink-500">
            {minutesRemaining > 99 ? "--" : minutesRemaining}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default TripProgressIndicator;
