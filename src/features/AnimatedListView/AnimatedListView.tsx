/**
 * AnimatedListView – Generic ScrollView-based list with scroll-driven animations.
 * Supports any data type through renderItem callback, configurable layout,
 * and pluggable animation hooks. Maintains compatibility with existing
 * demo while providing maximum flexibility for future use cases.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import AnimatedListItemWrapper from "./AnimatedListItemWrapper";
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
 */
const AnimatedListView = <T,>({
  data,
  renderItem,
  layout,
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

  // Calculate snap offsets for fixed-size items
  const snapOffsets = useMemo(() => {
    return data.map((_, index) => index * (itemSize + spacing));
  }, [data, itemSize, spacing]);

  // Calculate padding to position active item correctly
  const mainPadding = useMemo(() => {
    const containerSize = isHorizontal
      ? containerDims.width
      : containerDims.height;
    if (containerSize === 0) return 0;
    const activePosition = containerSize * activePositionRatio;
    const offsetToCenterItem = activePosition - itemSize / 2;
    return Math.max(0, offsetToCenterItem);
  }, [containerDims, activePositionRatio, itemSize, isHorizontal]);

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
          <AnimatedListItemWrapper
            key={String(index)}
            index={index}
            scrollIndex={scrollIndex}
            layout={layout}
          >
            {renderItem(item, index, {
              index,
              scrollIndex,
            })}
          </AnimatedListItemWrapper>
        ))}
      </Animated.ScrollView>
    </View>
  );
};

export default AnimatedListView;
export type { AnimatedListViewProps } from "./types";
