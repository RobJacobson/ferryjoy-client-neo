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
  /**
   * Ref to BlurTargetView; card uses BlurView with this as blur source.
   * Required for glassmorphism effect behind the card.
   */
  blurTargetRef: RefObject<View | null>;
  /**
   * Terminal card data. Includes terminal info, destinations, and optional
   * isPlaceholder flag for invisible placeholder items.
   */
  data: TerminalCardData & { isPlaceholder?: boolean };
};

/**
 * Renders a single terminal card with blur background and destination buttons.
 * Card fills container via flex and maintains 9:16 aspect ratio.
 * Tapping a destination sets the terminal pair and navigates to the map tab.
 *
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 * @param data - Terminal card data with optional isPlaceholder flag
 */
export const RouteCard = ({ blurTargetRef, data }: RouteCardProps) => {
  const { terminalName, terminalSlug, destinations, isPlaceholder } = data;

  const handleDestinationPress = useDestinationNavigation(terminalSlug);

  if (isPlaceholder) {
    return (
      <View
        className="flex-1"
        style={{ opacity: 0, pointerEvents: "none" } as const}
      />
    );
  }

  return (
    <BlurView
      blurTarget={blurTargetRef}
      intensity={16}
      blurMethod="dimezisBlurView"
      style={{ borderRadius: 24 }}
      className="flex-1"
    >
      <View className="flex-1 gap-1 rounded-[24px] border border-white/50 bg-white/15 p-4">
        <View className="relative mb-6 aspect-[3/4] w-full">
          <View className="h-full w-full items-center justify-center rounded-3xl border border-white/60 bg-fuscia-200">
            <Text className="text-gray-400">Photo Placeholder</Text>
          </View>
          <View className="absolute right-0 bottom-[-20px] left-0">
            <Button
              className="self-center border bg-fuscia-600 py-1 hover:bg-fuscia-500 active:bg-fuscia-400"
              variant="glass"
            >
              <Text
                className="translate-y-[2px] whitespace-normal px-4 pt-[2px] text-center font-puffberry text-lg text-white xs:text-xl leading-none tracking-wide"
                style={{
                  textShadowColor: "rgba(0,0,0,0.2)",
                  textShadowOffset: { width: 2, height: 2 },
                  textShadowRadius: 2,
                  elevation: 4,
                }}
              >
                {terminalName}
              </Text>
            </Button>
          </View>
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
