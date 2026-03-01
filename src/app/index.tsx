import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { Background } from "@/features/Background";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel";
import { RoutesCarousel } from "@/features/RoutesCarousel";

export default function Home() {
  const blurTargetRef = useRef<View | null>(null);
  const carouselRef = useRef<RoutesCarouselRef>(null);

  return (
    <View className="h-full w-full flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <BlurTargetView ref={blurTargetRef} className="absolute inset-0">
        <Background scrollProgress={carouselRef.current?.scrollProgress} />
      </BlurTargetView>
      <View className="relative z-[200] flex-1">
        <RoutesCarousel ref={carouselRef} blurTargetRef={blurTargetRef} />
      </View>
    </View>
  );
}
