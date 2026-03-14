import { BlurTargetView } from "expo-blur";
import { Stack, useRouter } from "expo-router";
import { type ComponentRef, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";
import { Button, Text, View } from "@/components/ui";
import { TOTAL_CAROUSEL_ITEMS } from "@/data/terminalConnections";
import { Background, ParallaxProvider } from "@/features/Background";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel";
import { RoutesCarousel, useCardDimensions } from "@/features/RoutesCarousel";

export default function Home() {
  const router = useRouter();
  const blurTargetRef = useRef<ComponentRef<typeof View> | null>(null);
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
        <View className="pointer-events-box-none absolute inset-x-0 bottom-10 z-[250] items-center px-6">
          <Button
            variant="glass-light"
            size="lg"
            onPress={() => router.push("/vessel-timeline-placeholder")}
          >
            <Text className="font-semibold text-white">Vessel Timeline</Text>
          </Button>
        </View>
      </View>
    </ParallaxProvider>
  );
}
