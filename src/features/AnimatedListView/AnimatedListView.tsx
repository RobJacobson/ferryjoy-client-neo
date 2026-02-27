/**
 * AnimatedListView – Generic ScrollView-based list with scroll-driven animations.
 * Supports any data type through renderItem callback, configurable layout,
 * and pluggable animation hooks. Maintains compatibility with existing
 * demo while providing maximum flexibility for future use cases.
 */

import { useState } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import Animated, {
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import AnimatedListItem from "./AnimatedListItem";
import type { AnimatedListViewProps } from "./types";

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
 */
const AnimatedListView = <T,>({
  data,
  renderItem,
  layout,
  itemAnimationStyle,
}: AnimatedListViewProps<T>) => {
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
  const scrollOffset = useScrollOffset(scrollRef);

  // Convert scroll position to normalized index
  const scrollIndex = useDerivedValue(
    () => scrollOffset.value / (itemSize + spacing)
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

export default AnimatedListView;
export type { AnimatedListViewProps } from "./types";
