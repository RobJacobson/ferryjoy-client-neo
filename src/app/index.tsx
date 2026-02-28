import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { Background } from "@/features/Background";
import { RoutesCarousel } from "@/features/RoutesCarousel";

export default function Home() {
  const blurTargetRef = useRef<View | null>(null);
  const scrollProgress = useSharedValue(0);

  return (
    <View className="h-full w-full flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <BlurTargetView ref={blurTargetRef} className="absolute inset-0">
        <Background scrollProgress={scrollProgress} />
      </BlurTargetView>
      <View className="relative z-[200] flex-1">
        <RoutesCarousel
          scrollProgress={scrollProgress}
          blurTargetRef={blurTargetRef}
        />
      </View>
    </View>
  );
}
