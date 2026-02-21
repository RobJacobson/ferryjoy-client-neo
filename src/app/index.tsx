import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { Background } from "@/features/Background";
import { CAROUSEL_Z_INDEX } from "@/features/RoutesCarousel/config";
import RoutesCarousel from "@/features/RoutesCarousel/RoutesCarousel";

export default function Home() {
  const blurTargetRef = useRef<View | null>(null);
  const scrollX = useSharedValue(0);
  const [slotWidth, setSlotWidth] = useState(0);

  const onSlotWidthChange = useCallback((w: number) => {
    setSlotWidth(w);
  }, []);

  return (
    <View className="h-full w-full flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <BlurTargetView ref={blurTargetRef} className="absolute inset-0">
        <Background scrollX={scrollX} slotWidth={slotWidth} />
      </BlurTargetView>
      <View style={{ zIndex: CAROUSEL_Z_INDEX }} className="relative flex-1">
        <RoutesCarousel
          scrollX={scrollX}
          onSlotWidthChange={onSlotWidthChange}
        />
      </View>
    </View>
  );
}
