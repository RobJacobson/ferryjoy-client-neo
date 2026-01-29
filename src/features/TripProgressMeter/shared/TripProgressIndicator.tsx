/**
 * TripProgressIndicator component for rendering a progress indicator overlay
 * that displays minutes remaining in a circular badge.
 */

import type { ReactElement } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";
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
  minutesRemaining?: number;
  /**
   * Optional label content to display above the indicator.
   * Must be a ReactElement (e.g., a Text component).
   */
  labelAbove?: ReactElement;
  /**
   * Optional className applied to the indicator circle container.
   * Use this to theme background/border colors per feature.
   */
  badgeClassName?: string;
  /**
   * Optional className applied to the minutes text inside the indicator.
   */
  minutesClassName?: string;
};

// ============================================================================
// Component
// ============================================================================

const INDICATOR_SIZE = 32;
const INDICATOR_Z_INDEX = 50;

/**
 * Renders a progress indicator positioned based on progress value within the parent bar.
 * The indicator is absolutely positioned and displays the minutes remaining.
 * Optionally displays a label above the indicator when labelAbove is provided.
 *
 * @param progress - Progress value (0-1) for horizontal positioning
 * @param minutesRemaining - Minutes remaining to display
 * @param labelAbove - Optional label text to display above the indicator
 * @returns A View component containing the indicator and optional label
 */
const TripProgressIndicator = ({
  progress,
  minutesRemaining,
  labelAbove,
  badgeClassName,
  minutesClassName,
}: TripProgressIndicatorProps) => {
  const displayMinutes =
    minutesRemaining === undefined ? "--" : String(minutesRemaining);

  return (
    <View
      className="absolute items-center justify-center"
      pointerEvents="none"
      collapsable={false}
      style={{
        top: "50%",
        left: `${progress * 100}%`,
        width: INDICATOR_SIZE,
        height: INDICATOR_SIZE,
        transform: [
          { translateX: -INDICATOR_SIZE / 2 },
          { translateY: -INDICATOR_SIZE / 2 },
        ],
        zIndex: INDICATOR_Z_INDEX,
        elevation: INDICATOR_Z_INDEX,
        overflow: "visible",
      }}
    >
      {/* Label above indicator - centered horizontally via items-center on parent */}
      {labelAbove && (
        <View
          pointerEvents="none"
          collapsable={false}
          className="absolute items-center"
          style={{
            bottom: INDICATOR_SIZE + 2,
            width: 200, // Sufficient width to prevent wrapping
          }}
        >
          {labelAbove}
        </View>
      )}
      {/* Indicator circle */}
      <View
        className={cn(
          "rounded-full items-center justify-center border-2 bg-pink-50 border-pink-500",
          badgeClassName,
        )}
        style={{
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          ...shadowStyle,
        }}
      >
        <Text
          className={cn(
            "font-bold text-pink-500",
            minutesClassName,
            minutesRemaining === undefined || minutesRemaining < 100
              ? "text-sm"
              : "text-xs",
          )}
          // numberOfLines={1}
        >
          {displayMinutes}
        </Text>
      </View>
    </View>
  );
};

export default TripProgressIndicator;
