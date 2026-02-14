/**
 * RouteCard – Glass-style card for a terminal and its destination buttons.
 * Uses BlurView with an external blur target; navigates to map with selected pair.
 */

import { BlurView } from "expo-blur";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import type { RefObject } from "react";
import { Platform, Text, View } from "react-native";
import { GlassView } from "@/components/GlassView";
import { Button } from "@/components/ui";
import { useSelectedTerminalPair } from "@/data/contexts";
import type { TerminalCardData } from "@/data/terminalConnections";

// ============================================================================
// Types
// ============================================================================

type RouteCardProps = {
  /** Ref to BlurTargetView; card uses BlurView with this as blur source. */
  blurTargetRef: RefObject<View | null>;
  terminalName: string;
  terminalSlug: string;
  destinations: TerminalCardData["destinations"];
};

// ============================================================================
// RouteCard
// ============================================================================

/**
 * Renders a single terminal card with blur background and destination buttons.
 * Card fills container via flex and maintains 9:16 aspect ratio.
 * Tapping a destination sets the terminal pair and navigates to the map tab.
 *
 * @param props - blurTargetRef, terminal name/slug, destinations
 */
export const RouteCard = ({
  blurTargetRef,
  terminalName,
  terminalSlug,
  destinations,
}: RouteCardProps) => {
  const router = useRouter();
  const { setPair } = useSelectedTerminalPair();

  const handleDestinationPress = (destinationSlug: string) => {
    // Convert both origin and destination slugs to uppercase abbreviations
    const fromAbbrev = terminalSlug.toUpperCase();
    const destAbbrev = destinationSlug.toUpperCase();
    void setPair(fromAbbrev, destAbbrev);
    router.push(`/(tabs)/map/${fromAbbrev}/${destAbbrev}` as Href);
  };

  return (
    <BlurView
      blurTarget={blurTargetRef}
      intensity={12}
      blurMethod="dimezisBlurView"
      className="m-14 aspect-[9/16] border-radius-[32px]"
    >
      <GlassView className="flex-1 gap-4 rounded-[24px] p-4">
        <View className="relative aspect-[3/4] w-full">
          <GlassView className="h-full w-full items-center justify-center rounded-3xl bg-gray-200/25">
            <Text className="text-gray-400">Photo Placeholder</Text>
          </GlassView>
          <View className="absolute right-0 bottom-[-22px] left-0">
            <Button
              className="max-w-full self-center rounded-full bg-pink-600 hover:bg-pink-300 active:bg-pink-400"
              style={{
                shadowColor: "rgba(0,0,0,0.2)",
                shadowOffset: { width: 2, height: 2 },
                shadowRadius: 4,
                elevation: 4,
              }}
              variant="glass"
            >
              <Text
                className="translate-y-1 whitespace-normal px-4 pt-[2px] text-center font-puffberry text-lg text-white leading-none tracking-wide sm:px-16"
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

        <View className="mt-4 h-full w-full flex-1 items-center justify-center gap-1 xs:gap-2">
          {destinations.map((destination) => (
            <Button
              key={destination.terminalSlug}
              variant="glass"
              size="sm"
              onPress={() => handleDestinationPress(destination.terminalSlug)}
              className="w-2/3 rounded-full py-1 sm:py-2"
            >
              <Text className="font-playpen-600 text-pink-600 text-sm">
                → {destination.terminalName}
              </Text>
            </Button>
          ))}
        </View>
      </GlassView>
    </BlurView>
  );
};
