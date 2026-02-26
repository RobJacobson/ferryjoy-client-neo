import { useMemo } from "react";
import Animated, {
  scrollTo,
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import type { Item } from "@/shared/utils/fakerData";
import { useAvailableDimensions } from "@/shared/utils/useAvailableDimensions";
import {
  ACTIVE_CARD_POSITION_RATIO,
  CARD_HEIGHT_RATIO,
  SPACING,
} from "./types";
import AnimatedListViewItem from "./AnimatedListViewItem";

type AnimatedListViewProps = {
  data: (Item & { key: string })[];
};

const AnimatedListView = ({ data }: AnimatedListViewProps) => {
  const { availableHeight: totalHeight } = useAvailableDimensions();

  // Fixed card height
  const cardHeight = Math.floor(totalHeight * CARD_HEIGHT_RATIO);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  // Convert scroll position to normalized index (like the PexelsList example)
  const scrollIndex = useDerivedValue(
    () => scrollOffset.value / (cardHeight + SPACING)
  );

  // Calculate vertical position for the active card
  // ACTIVE_CARD_POSITION_RATIO: 0 = top, 0.5 = center, 1 = bottom
  const activeCardYPosition = totalHeight * ACTIVE_CARD_POSITION_RATIO;
  const topPadding = Math.max(0, activeCardYPosition - cardHeight / 2);

  // Calculate snap offsets for fixed-size cards
  const snapOffsets = useMemo(() => {
    return data.map((_, index) => topPadding + index * (cardHeight + SPACING));
  }, [data, cardHeight, topPadding]);

  // Calculate total content height
  const totalContentHeight = useMemo(() => {
    return data.length * (cardHeight + SPACING);
  }, [data.length, cardHeight]);

  const sidePadding = 16;

  return (
    <Animated.ScrollView
      ref={scrollRef}
      snapToOffsets={snapOffsets}
      snapToEnd={false}
      snapToStart={false}
      decelerationRate="fast"
      contentContainerStyle={{
        paddingVertical: topPadding,
        paddingHorizontal: sidePadding,
        height: totalContentHeight + topPadding * 2,
      }}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {data.map((item, index) => (
        <AnimatedListViewItem
          key={item.key}
          item={item}
          index={index}
          scrollIndex={scrollIndex}
          cardHeight={cardHeight}
        />
      ))}
    </Animated.ScrollView>
  );
};

export default AnimatedListView;
