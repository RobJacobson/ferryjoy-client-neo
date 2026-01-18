import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Dimensions, View } from "react-native";
// Do not import SafeAreaView from react-naitve, which is deprecated
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { Wave } from "@/components/Wave2";
import type { TerminalRegion } from "@/data/terminalRegions";
import { RegionSelector, useRegionSelector } from "@/features/RegionSelector";
import { RoutesCarousel } from "@/features/RoutesCarousel/RoutesCarousel";

const { width } = Dimensions.get("window");

export default function Home() {
  const { selectedRegion: regionFromStorage, isHydrated } = useRegionSelector();
  const [selectedRegion, setSelectedRegion] =
    useState<TerminalRegion>(regionFromStorage);

  // Sync with storage when it hydrates or changes
  useEffect(() => {
    if (isHydrated && regionFromStorage) {
      setSelectedRegion(regionFromStorage);
    }
  }, [isHydrated, regionFromStorage]);

  const handleRegionChange = (region: TerminalRegion) => {
    setSelectedRegion(region);
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background Wave */}
      <View className="absolute top-0 left-0 right-0 h-full z-0">
        <Wave
          height={300}
          width={width}
          period={width}
          color="#81b0ff" // Example color, adjust as needed
          offsetY={100}
          showPaperGrains={true}
        />
        <View className="absolute top-[200px] left-0 right-0 bottom-0 bg-[#81b0ff]" />
      </View>

      <SafeAreaView className="flex-1 z-10">
        <View className="px-6 pt-12 pb-6">
          <Text className="text-4xl font-bold text-white tracking-tight">
            Ferryjoy
          </Text>

          <RegionSelector onRegionChange={handleRegionChange} />
        </View>

        <RoutesCarousel selectedRegion={selectedRegion} />
      </SafeAreaView>
    </View>
  );
}
