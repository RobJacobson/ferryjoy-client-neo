/**
 * useAnimatedListLayout – Hook for managing AnimatedList layout calculations.
 * Handles dimension tracking, direction determination, and style calculations.
 */

import { useState } from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import type { AnimatedListLayout } from "../types";

/**
 * Hook that manages layout-related state and calculations for AnimatedList.
 * Handles ScrollView dimension tracking, item sizing, and padding calculations.
 *
 * @param layout - Layout configuration for the list
 * @returns Object containing layout state and computed styles
 */
export function useAnimatedListLayout(layout: AnimatedListLayout) {
  // Store ScrollView dimensions for accurate centering calculation
  const [scrollViewSize, setScrollViewSize] = useState({
    width: 0,
    height: 0,
  });

  /**
   * Handles layout event to capture ScrollView dimensions.
   * Used for accurate item centering instead of window dimensions.
   *
   * @param e - LayoutChangeEvent containing width and height
   */
  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setScrollViewSize({ width, height });
  };

  // Extract layout configuration
  const { direction = "vertical", itemSize, spacing = 0 } = layout;

  // Determine if the list is horizontal or vertical
  const isHorizontal = direction === "horizontal";

  // Calculate padding to center items in viewport
  const crossAxisSize = isHorizontal
    ? scrollViewSize.width
    : scrollViewSize.height;
  const crossAxisPadding = Math.max(0, (crossAxisSize - itemSize) / 2);

  // Item sizing based on direction
  const itemSizeStyle: ViewStyle = isHorizontal
    ? { height: "100%", width: itemSize }
    : { width: "100%", height: itemSize };

  // Build content container style with padding for centering
  const contentContainerStyle: ViewStyle = {
    gap: spacing,
    ...(isHorizontal
      ? { paddingHorizontal: crossAxisPadding }
      : { paddingVertical: crossAxisPadding }),
  };

  return {
    handleLayout,
    isHorizontal,
    itemSizeStyle,
    contentContainerStyle,
  };
}
