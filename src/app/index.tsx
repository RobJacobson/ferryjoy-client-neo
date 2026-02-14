import { BlurTargetView } from "expo-blur";
import { Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Background } from "@/features/Background";
import RoutesCarousel from "@/features/RoutesCarousel";

export default function Home() {
  const blurTargetRef = useRef<View | null>(null);
  const insets = useSafeAreaInsets();
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
        <Background />
      </BlurTargetView>
      <RoutesCarousel blurTargetRef={blurTargetRef} />
    </View>
  );
}
