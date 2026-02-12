import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import RoutesCarousel from "@/features/RoutesCarousel/RoutesCarousel";
import { Sky } from "@/features/Sky";
import AnimatedWaves from "@/features/Waves";

export default function Home() {
  // const { selectedRegion } = useRegionSelector();
  const blurTargetRef = useRef<View | null>(null);

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <BlurTargetView ref={blurTargetRef} className="absolute inset-0">
        <Sky />
        <View className="absolute top-0 right-0 bottom-0 left-0">
          <AnimatedWaves />
        </View>
      </BlurTargetView>
      <RoutesCarousel blurTargetRef={blurTargetRef} />
    </View>
  );
}
