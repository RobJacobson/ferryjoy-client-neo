/**
 * RouteCard – Glass-style terminal card with destination buttons.
 *
 * CRITICAL: BlurView requires explicit width/height props - cannot rely on flex sizing.
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
 * Renders a single terminal card with glassmorphism and destination buttons.
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

  // Navigation hook for destination button presses
  const handleDestinationPress = useDestinationNavigation(terminalSlug);

  // Placeholder card for visual balance
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
      <View className="flex-1 rounded-[24px] border border-white/50 bg-white/15 p-4">
        {/* Photo section with overlapping terminal name button */}
        <View className="relative mb-6 aspect-[3/4] w-full">
          <View className="h-full w-full items-center justify-center rounded-3xl border border-white/60 bg-fuscia-200">
            <Text className="text-gray-400">Photo Placeholder</Text>
          </View>

          {/* Terminal name button straddles photo and destination sections */}
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

        {/* Destination buttons stack */}
        <View className="flex-1 items-center justify-center gap-2">
          {destinations.map((destination) => (
            <Button
              key={destination.terminalSlug}
              variant="glass"
              onPress={() => handleDestinationPress(destination.terminalSlug)}
              className="w-3/4"
            >
              <Text className="font-playpen-500 text-sm text-white">
                → {destination.terminalName}
              </Text>
            </Button>
          ))}
        </View>
      </View>
    </BlurView>
  );
};
