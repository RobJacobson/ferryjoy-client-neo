/**
 * AnimatedListItem – Internal component that applies optional animation styles
 * to list items. Wraps renderItem content with Animated.View and applies
 * animation style from provided hook.
 */

import type { ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { cn } from "@/shared/utils/cn";
import type { AnimatedListLayout, ItemAnimationStyle } from "./types";

type AnimatedListItemProps<T> = {
  item: T;
  index: number;
  scrollIndex: SharedValue<number>;
  itemSizeStyle: ViewStyle;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemAnimationStyle?: ItemAnimationStyle;
  layout: AnimatedListLayout;
  itemClassName?: string;
};

/**
 * Internal component that wraps each item with an Animated.View
 * and applies optional animation styles.
 *
 * @param item - Data item to render
 * @param index - Item index
 * @param scrollIndex - Shared value of scroll position for animation
 * @param itemSizeStyle - Sizing style for the item
 * @param renderItem - Function to render item content
 * @param itemAnimationStyle - Optional animation worklet function
 * @param layout - Layout configuration
 * @param itemClassName - Optional custom className for the item wrapper
 */
const AnimatedListItem = <T,>({
  item,
  index,
  scrollIndex,
  itemSizeStyle,
  renderItem,
  itemAnimationStyle,
  layout,
  itemClassName,
}: AnimatedListItemProps<T>) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (itemAnimationStyle) {
      return itemAnimationStyle(scrollIndex, index, layout);
    }
    return {};
  });

  return (
    <Animated.View
      style={[itemSizeStyle, animatedStyle]}
      className={cn("overflow-hidden", itemClassName)}
      testID={`animated-list-item-${index}`}
    >
      {renderItem(item, index)}
    </Animated.View>
  );
};

export default AnimatedListItem;
