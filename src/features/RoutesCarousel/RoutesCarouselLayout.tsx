import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type RoutesCarouselLayoutProps = {
  cardHeight: number;
  children: ReactNode;
};

/**
 * Layout wrapper for the RoutesCarousel that handles safe area padding and centering.
 *
 * Provides consistent spacing around the carousel content by applying safe area insets
 * and centering the content both horizontally and vertically.
 *
 * @param cardHeight - Height of the carousel cards for container sizing
 * @param children - Carousel content to be wrapped
 */
const RoutesCarouselLayout = ({
  cardHeight,
  children,
}: RoutesCarouselLayoutProps) => {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingLeft: safeAreaInsets.left,
        paddingRight: safeAreaInsets.right,
        paddingTop: safeAreaInsets.top,
        paddingBottom: safeAreaInsets.bottom,
      }}
      className="flex-1 items-center justify-center"
    >
      <View className="flex-1 items-center justify-center">
        <View style={{ height: cardHeight }}>{children}</View>
      </View>
    </View>
  );
};

export { RoutesCarouselLayout };
