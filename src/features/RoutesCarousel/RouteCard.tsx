/**
 * RouteCard – Glass-style card for a terminal and its destination buttons.
 * Uses BlurView with an external blur target; navigates to map with selected pair.
 */

import type { RefObject } from "react";
import { Text, View } from "react-native";
import { BlurView } from "@/components/BlurView";
import { Button } from "@/components/ui";
import type { TerminalCardData } from "@/data/terminalConnections";
import { useDestinationNavigation } from "@/shared/hooks";

type RouteCardProps = {
  blurTargetRef: RefObject<View | null>;
  data: TerminalCardData & { isPlaceholder?: boolean };
  width: number;
  height: number;
};

/**
 * Renders a single terminal card with blur background and destination buttons.
 * Card fills container via flex and maintains 9:16 aspect ratio.
 * Tapping a destination sets the terminal pair and navigates to map tab.
 *
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 * @param data - Terminal card data with optional isPlaceholder flag
 * @param width - Width of carousel slot in pixels
 * @param height - Height of carousel slot in pixels
 */
export const RouteCard = ({
  blurTargetRef,
  data,
  width,
  height,
}: RouteCardProps) => {
  const { terminalName, terminalSlug, destinations, isPlaceholder } = data;

  const handleDestinationPress = useDestinationNavigation(terminalSlug);

  if (isPlaceholder) {
    return <View style={{ width, height }} className="bg-green-500/25" />;
  }

  return (
    <BlurView
      blurTarget={blurTargetRef}
      intensity={16}
      blurMethod="dimezisBlurView"
      style={{ width, height, borderRadius: 24 }}
    >
      <View className="flex-1 gap-1 rounded-[24px] border border-white/50 bg-white/15 p-4">
        <View className="mb-6 h-full w-full items-center justify-center rounded-3xl border border-white/60 bg-fuscia-200">
          <Text className="text-gray-400">Photo Placeholder</Text>
        </View>

        <View className="mb-1 flex-1 items-center justify-center">
          <Text className="font-bold text-2xl text-white">{terminalName}</Text>
        </View>

        <View className="flex-1 items-center justify-center gap-2 xs:gap-2">
          {destinations.map((destination) => (
            <Button
              key={destination.terminalSlug}
              variant="glass"
              onPress={() => handleDestinationPress(destination.terminalSlug)}
              className="w-3/4"
            >
              <Text className="font-playpen-500 text-sm text-white xs:text-base">
                → {destination.terminalName}
              </Text>
            </Button>
          ))}
        </View>
      </View>
    </BlurView>
  );
};
