/**
 * AnimatedListItem – Internal component that applies optional animation styles
 * to list items. Wraps renderItem content with Animated.View and applies
 * animation style from provided hook.
 */

import type { ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { AnimationState, ItemAnimationStyle } from "./types";

type AnimatedListItemProps<T> = {
  item: T;
  index: number;
  animationState: AnimationState;
  itemSizeStyle: ViewStyle;
  renderItem: (
    item: T,
    index: number,
    animationState: AnimationState
  ) => React.ReactNode;
  itemAnimationStyle?: ItemAnimationStyle;
  layout: Parameters<ItemAnimationStyle>[2];
};

/**
 * Internal component that wraps each item with an Animated.View
 * and applies optional animation styles.
 *
 * @param item - Data item to render
 * @param index - Item index
 * @param animationState - Animation state with scroll index
 * @param itemSizeStyle - Sizing style for the item
 * @param renderItem - Function to render item content
 * @param itemAnimationStyle - Optional animation worklet function
 * @param layout - Layout configuration
 */
const AnimatedListItem = <T,>({
  item,
  index,
  animationState,
  itemSizeStyle,
  renderItem,
  itemAnimationStyle,
  layout,
}: AnimatedListItemProps<T>) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (itemAnimationStyle) {
      return itemAnimationStyle(animationState.scrollIndex, index, layout);
    }
    return {};
  });

  return (
    <Animated.View
      style={[itemSizeStyle, animatedStyle]}
      className="overflow-hidden rounded-2xl"
    >
      {renderItem(item, index, animationState)}
    </Animated.View>
  );
};

export default AnimatedListItem;
