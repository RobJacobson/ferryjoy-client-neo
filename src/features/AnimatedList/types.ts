/**
 * AnimatedList types and interfaces.
 * Provides generic types for flexible, customizable list components with
 * scroll-driven animations.
 */

import type React from "react";
import type { ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";

/**
 * Scroll direction for the animated list.
 */
export type AnimatedListDirection = "horizontal" | "vertical";

/**
 * Layout configuration for the animated list.
 * Defines spacing, sizing, and positioning of list items.
 */
export type AnimatedListLayout = {
  direction?: "horizontal" | "vertical";
  itemSize: number;
  spacing?: number;
  activePositionRatio?: number;
};

/**
 * Animation state passed to renderItem and animation hooks.
 * Provides current scroll position and item-specific animation data.
 */
export type AnimationState = {
  index: number;
  scrollIndex: SharedValue<number>;
};

/**
 * Return type for animation style hooks.
 * Combines standard view style with zIndex for layering.
 */
export type AnimatedStyleResult = ViewStyle & {
  zIndex?: number;
};

/**
 * Signature for custom animation worklet functions.
 * Allows users to define their own scroll-driven animations.
 * Note: This is a worklet function, not a React hook, despite the name.
 *
 * @param scrollIndex - Shared value of current scroll position (normalized to index)
 * @param index - Index of the current item
 * @param layout - Layout configuration for the list
 * @returns Animated style object for the item
 */
export type ItemAnimationStyle = (
  scrollIndex: SharedValue<number>,
  index: number,
  layout: AnimatedListLayout
) => AnimatedStyleResult;

/**
 * Signature for renderItem callback.
 * Provides item data, index, and animation state for custom rendering.
 *
 * @param item - The data item to render
 * @param index - Index of the item in the list
 * @param animationState - Current animation state for the item (contains index and SharedValue scrollIndex)
 * @returns React element to render for this item
 */
export type RenderItem<T> = (
  item: T,
  index: number,
  animationState: AnimationState
) => React.ReactNode;

/**
 * Imperative handle for programmatic list control.
 * Allows parent components to control scrolling behavior.
 */
export type AnimatedListRef = {
  scrollToIndex: (index: number, animated?: boolean) => void;
};

/**
 * Props for the generic AnimatedList component.
 * Supports any data type with configurable rendering and animations.
 *
 * @template T - Type of data items in the list
 */
export type AnimatedListProps<T> = {
  data: T[];
  renderItem: RenderItem<T>;
  layout: AnimatedListLayout;
  itemAnimationStyle?: ItemAnimationStyle;
  scrollOffset?: SharedValue<number>;
  onScrollEnd?: (activeIndex: number) => void;
  ref?: React.Ref<AnimatedListRef>;
};

// Legacy constants maintained for backward compatibility
export const SPACING = 4;
export const CARD_HEIGHT_RATIO = 0.3;
export const ACTIVE_CARD_POSITION_RATIO = 0.5;
