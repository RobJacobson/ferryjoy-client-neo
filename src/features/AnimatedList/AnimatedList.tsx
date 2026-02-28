/**
 * AnimatedList – Generic ScrollView-based list with scroll-driven animations.
 * Supports any data type through renderItem callback, configurable layout,
 * and pluggable animation hooks. Maintains compatibility with existing
 * demo while providing maximum flexibility for future use cases.
 */

import { useImperativeHandle } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  type SharedValue,
  scrollTo,
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import AnimatedListItem from "./AnimatedListItem";
import { useAnimatedListLayout } from "./hooks/useAnimatedListLayout";
import { useScrollEndDetection } from "./hooks/useScrollEndDetection";
import type { AnimatedListProps } from "./types";

/**
 * Renders a generic animated list using ScrollView with scroll-driven animations.
 * Provides maximum flexibility for rendering any card-like element while handling
 * scroll tracking, snap behavior, and animation state management.
 *
 * @template T - Type of data items in list
 * @param data - Array of items to render
 * @param renderItem - Function to render each item with animation state
 * @param layout - Layout configuration for the list
 * @param itemAnimationStyle - Optional custom animation worklet function for item styling
 * @param ref - Ref for imperative scrollToIndex control
 * @param scrollOffset - Optional shared scroll offset value for parallax effects
 * @param onScrollEnd - Optional callback fired when scroll settles on an item
 * @param keyExtractor - Optional function to extract unique keys for items
 * @param itemClassName - Optional custom className for item wrapper (defaults to "overflow-hidden")
 */
const AnimatedList = <T,>({
  data,
  renderItem,
  layout,
  itemAnimationStyle,
  scrollOffset: externalScrollOffset,
  onScrollEnd,
  ref,
  keyExtractor,
  itemClassName,
}: AnimatedListProps<T>) => {
  // Manage layout calculations
  const { handleLayout, isHorizontal, itemSizeStyle, contentContainerStyle } =
    useAnimatedListLayout(layout);

  // Extract layout configuration needed for scroll calculations
  const { itemSize, spacing = 0 } = layout;

  // Manage scroll internally
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const internalScrollOffset = useScrollOffset(scrollRef);

  // Use external scroll offset if provided for parallax effects, otherwise track internally
  const scrollOffset: SharedValue<number> =
    externalScrollOffset ?? internalScrollOffset;

  // Convert scroll position to normalized index with division by zero protection
  const itemStride = Math.max(1, itemSize + spacing);
  const scrollIndex = useDerivedValue(() => scrollOffset.value / itemStride);

  // Imperative handle for programmatic scrolling
  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index: number, animated = true) => {
        const clamped = Math.max(0, Math.min(index, data.length - 1));
        const targetOffset = clamped * (itemSize + spacing);

        scheduleOnUI(() => {
          "worklet";
          if (isHorizontal) {
            scrollTo(scrollRef, targetOffset, 0, animated);
          } else {
            scrollTo(scrollRef, 0, targetOffset, animated);
          }
        });
      },
    }),
    [scrollRef, data.length, itemSize, spacing, isHorizontal]
  );

  // Detect when scroll settles on an index and trigger callback
  useScrollEndDetection(scrollIndex, onScrollEnd);

  // Snap offsets for each item
  const snapOffsets = data.map((_, index) => index * (itemSize + spacing));

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal={isHorizontal}
      snapToOffsets={snapOffsets}
      snapToEnd={false}
      snapToStart={false}
      decelerationRate="fast"
      contentContainerStyle={contentContainerStyle}
      style={
        { scrollSnapType: `${isHorizontal ? "x" : "y"} mandatory` } as ViewStyle
      }
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Animated list"
      accessibilityRole="scrollbar"
      testID="animated-list"
      onLayout={handleLayout}
    >
      {data.map((item, index) => (
        <AnimatedListItem
          key={keyExtractor ? keyExtractor(item, index) : String(index)}
          item={item}
          index={index}
          scrollIndex={scrollIndex}
          itemSizeStyle={itemSizeStyle}
          renderItem={renderItem}
          itemAnimationStyle={itemAnimationStyle}
          layout={layout}
          itemClassName={itemClassName}
        />
      ))}
    </Animated.ScrollView>
  );
};

export default AnimatedList;
export type { AnimatedListProps } from "./types";
