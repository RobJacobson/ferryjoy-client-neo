/**
 * AnimatedList – Generic ScrollView-based list with scroll-driven animations.
 * Supports any data type through renderItem callback, configurable layout,
 * and pluggable animation hooks. Maintains compatibility with existing
 * demo while providing maximum flexibility for future use cases.
 */

import { useImperativeHandle, useRef, useState } from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import Animated, {
  type SharedValue,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import AnimatedListItem from "./AnimatedListItem";
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
  // Extract layout configuration
  const { direction = "vertical", itemSize, spacing = 0 } = layout;

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

  // Determine if the list is horizontal or vertical
  const isHorizontal = direction === "horizontal";

  // Track previous active index for scroll end callback
  const previousActiveIndex = useRef<number | null>(null);

  // Track if we're settled on an index (within 0.1 tolerance)
  const isSettledIndex = useRef<boolean>(true);

  // Manage scroll internally
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const internalScrollOffset = useScrollOffset(scrollRef);
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

  // Call onScrollEnd when scroll settles on an item (only when index changes)
  // Uses 0.1 tolerance to determine when scroll has settled on an index
  useAnimatedReaction(
    () => {
      if (!onScrollEnd) return undefined;
      const currentScrollIndex = scrollIndex.value;
      const activeIndex = Math.round(currentScrollIndex);
      const distanceFromIndex = Math.abs(currentScrollIndex - activeIndex);
      const settled = distanceFromIndex < 0.1;
      return { activeIndex, settled };
    },
    (data) => {
      if (data && onScrollEnd) {
        const { activeIndex, settled } = data;
        // Only trigger when transitioning from not-settled to settled on a new index
        if (
          settled &&
          !isSettledIndex.current &&
          activeIndex !== previousActiveIndex.current
        ) {
          isSettledIndex.current = true;
          previousActiveIndex.current = activeIndex;
          scheduleOnRN(onScrollEnd, activeIndex);
        } else if (!settled) {
          // Mark as not settled when scrolling away
          isSettledIndex.current = false;
        }
      }
    },
    [onScrollEnd]
  );

  // Snap offsets for each item
  const snapOffsets = data.map((_, index) => index * (itemSize + spacing));

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
