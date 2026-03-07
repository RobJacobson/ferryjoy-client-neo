import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { TOTAL_CAROUSEL_ITEMS } from "@/data/terminalConnections";
import { Background, ParallaxProvider } from "@/features/Background";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel";
import { RoutesCarousel } from "@/features/RoutesCarousel";
import { useCardDimensions } from "@/features/RoutesCarousel/useCardDimensions";

export default function Home() {
  const blurTargetRef = useRef<View | null>(null);
  const carouselRef = useRef<RoutesCarouselRef>(null);
  const scrollProgress = useSharedValue(0);
  const { layout } = useCardDimensions();

  const itemStride = layout.itemSize + layout.spacing;
  const scrollableRange = (TOTAL_CAROUSEL_ITEMS - 1) * itemStride;

  return (
    <ParallaxProvider scrollProgress={scrollProgress}>
      <View className="h-full w-full flex-1">
        <Stack.Screen options={{ headerShown: false }} />
        <BlurTargetView ref={blurTargetRef} className="absolute inset-0">
          <Background
            scrollableRange={scrollableRange}
            itemStride={itemStride}
          />
        </BlurTargetView>
        <View className="relative z-[200] mt-8 flex-1">
          <RoutesCarousel
            ref={carouselRef}
            blurTargetRef={blurTargetRef}
            scrollProgressSink={scrollProgress}
          />
        </View>
      </View>
    </ParallaxProvider>
  );
}
