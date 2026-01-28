/**
 * TripProgressIndicator component for rendering a progress indicator overlay
 * that displays minutes remaining in a circular badge.
 */

import type { ReactElement } from "react";
import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
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
   * Optional z-index for stacking order.
   */
  zIndex?: number;
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
  badgeClassName,
  minutesClassName,
}: TripProgressIndicatorProps) => {
  const [labelWidth, setLabelWidth] = useState(0);

  const handleLabelLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setLabelWidth((prev) => (prev === width ? prev : width));
  };

  const displayMinutes =
    minutesRemaining === undefined ? "--" : String(minutesRemaining);

  return (
    <>
      {/* Label above indicator - positioned outside root View to avoid constraints */}
      {labelAbove && (
        <View
          pointerEvents="none"
          collapsable={false}
          style={{
            position: "absolute",
            top: "50%",
            left: `${progress * 100}%`,
            transform: [
              { translateX: -INDICATOR_SIZE / 2 },
              { translateY: -(INDICATOR_SIZE / 2 + INDICATOR_SIZE / 2 + 20) },
            ],
            zIndex: (zIndex ?? shadowStyle.elevation) + 1,
            elevation: (zIndex ?? shadowStyle.elevation) + 1,
            overflow: "visible",
          }}
          onLayout={handleLabelLayout}
        >
          <View
            style={{
              transform: [
                {
                  translateX:
                    labelWidth > 0
                      ? -labelWidth / 2 + INDICATOR_SIZE / 2
                      : INDICATOR_SIZE / 2,
                },
                { translateY: INDICATOR_SIZE / 2 },
              ],
            }}
          >
            {labelAbove}
          </View>
        </View>
      )}
      <View
        className="absolute"
        pointerEvents="none"
        collapsable={false}
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
          <View className="w-full items-center justify-center">
            <Text
              className={cn(
                "font-bold text-pink-500",
                minutesClassName,
                minutesRemaining === undefined || minutesRemaining < 100
                  ? "text-sm"
                  : "text-xs",
              )}
            >
              {displayMinutes}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
};

export default TripProgressIndicator;
