import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Background } from "@/features/Background";
import RoutesCarousel from "@/features/RoutesCarousel";
import { useCarouselLayout } from "@/features/RoutesCarousel/config";

export default function Home() {
  const blurTargetRef = useRef<View | null>(null);
  const insets = useSafeAreaInsets();
  const scrollX = useSharedValue(0);
  const { slotWidth, width } = useCarouselLayout();

  return (
    <View
      className="h-full w-full flex-1"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <BlurTargetView ref={blurTargetRef} className="absolute inset-0">
        <Background scrollX={scrollX} slotWidth={slotWidth} />
      </BlurTargetView>
      <RoutesCarousel
        blurTargetRef={blurTargetRef}
        scrollX={scrollX}
        slotWidth={slotWidth}
        viewportWidth={width}
      />
    </View>
  );
}
