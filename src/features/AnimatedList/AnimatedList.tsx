/**
 * AnimatedList – Generic ScrollView-based list with scroll-driven animations.
 * Supports any data type through renderItem callback, configurable layout,
 * and pluggable animation hooks. Maintains compatibility with existing
 * demo while providing maximum flexibility for future use cases.
 */

import { useImperativeHandle, useState } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
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
 */
const AnimatedList = <T,>({
  data,
  renderItem,
  layout,
  itemAnimationStyle,
  scrollOffset: externalScrollOffset,
  onScrollEnd,
  ref,
}: AnimatedListProps<T>) => {
  const {
    direction = "vertical",
    itemSize,
    spacing = 0,
    activePositionRatio = 0.5,
  } = layout;

  const [containerDims, setContainerDims] = useState({
    width: 0,
    height: 0,
  });

  const isHorizontal = direction === "horizontal";

  // Manage scroll internally
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const internalScrollOffset = useScrollOffset(scrollRef);
  const scrollOffset: SharedValue<number> =
    externalScrollOffset ?? internalScrollOffset;

  // Convert scroll position to normalized index
  const scrollIndex = useDerivedValue(
    () => scrollOffset.value / (itemSize + spacing)
  );

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

  // Call onScrollEnd when scroll settles on an item
  useAnimatedReaction(
    () => {
      if (!onScrollEnd) return undefined;
      const currentScrollIndex = scrollIndex.value;
      const activeIndex = Math.round(currentScrollIndex);
      return activeIndex;
    },
    (activeIndex) => {
      if (activeIndex !== undefined && onScrollEnd) {
        scheduleOnRN(onScrollEnd, activeIndex);
      }
    },
    [onScrollEnd]
  );

  // Snap offsets for each item
  const snapOffsets = data.map((_, index) => index * (itemSize + spacing));

  // Padding to center active item at configured position
  const containerSize = isHorizontal
    ? containerDims.width
    : containerDims.height;
  const mainPadding = Math.max(
    0,
    containerSize * activePositionRatio - itemSize / 2
  );

  // Item sizing based on direction
  const itemSizeStyle: ViewStyle = isHorizontal
    ? { height: "100%", width: itemSize }
    : { width: "100%", height: itemSize };

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerDims({ width, height });
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        horizontal={isHorizontal}
        snapToOffsets={snapOffsets}
        snapToEnd={false}
        snapToStart={false}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingTop: isHorizontal ? undefined : mainPadding,
          paddingBottom: isHorizontal ? undefined : mainPadding,
          paddingLeft: isHorizontal ? mainPadding : undefined,
          paddingRight: isHorizontal ? mainPadding : undefined,
          gap: spacing,
        }}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        {data.map((item, index) => (
          <AnimatedListItem
            key={String(index)}
            item={item}
            index={index}
            animationState={{ index, scrollIndex }}
            itemSizeStyle={itemSizeStyle}
            renderItem={renderItem}
            itemAnimationStyle={itemAnimationStyle}
            layout={layout}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
};

export default AnimatedList;
export type { AnimatedListProps } from "./types";
