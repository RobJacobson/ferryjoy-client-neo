import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { Background } from "@/features/Background";
import { CAROUSEL_Z_INDEX } from "@/features/RoutesCarousel/config";
import { RoutesCarouselSection } from "@/features/RoutesCarousel/RoutesCarouselSection";

export default function Home() {
  const blurTargetRef = useRef<View | null>(null);
  const scrollProgress = useSharedValue(0);

  return (
    <View className="h-full w-full flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <BlurTargetView ref={blurTargetRef} className="absolute inset-0">
        <Background scrollProgress={scrollProgress} />
      </BlurTargetView>
      <View style={{ zIndex: CAROUSEL_Z_INDEX }} className="relative flex-1">
        <RoutesCarouselSection
          scrollProgress={scrollProgress}
          blurTargetRef={blurTargetRef}
        />
      </View>
    </View>
  );
}
