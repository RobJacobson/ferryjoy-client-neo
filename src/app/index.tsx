import { Stack } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { RoutesCarousel } from "@/features/RoutesCarousel/RoutesCarousel";
import AnimatedWaves from "@/features/Waves";

export default function Home() {
  // const { selectedRegion } = useRegionSelector();

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute top-0 left-0 right-0 bottom-0">
        <AnimatedWaves />
      </View>

      <SafeAreaView className="flex-1 z-10">
        <View className="px-6 pt-12 pb-6">
          <Text className="text-4xl font-bold text-white tracking-tight">
            Ferryjoy
          </Text>
        </View>

        <RoutesCarousel />
      </SafeAreaView>
    </View>
  );
}
