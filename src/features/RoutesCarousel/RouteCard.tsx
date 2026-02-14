/**
 * RouteCard – Glass-style card for a terminal and its destination buttons.
 * Uses BlurView with an external blur target; navigates to map with selected pair.
 */

import { BlurView } from "expo-blur";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import type { RefObject } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { GlassView } from "@/components/GlassView";
import { Button } from "@/components/ui";
import { useSelectedTerminalPair } from "@/data/contexts";
import type { TerminalCardData } from "@/data/terminalConnections";
import { cn } from "@/lib/utils";

// ============================================================================
// Constants
// ============================================================================

/** Width above which we treat as tablet; use smaller destination text to avoid clipping. */
const TABLET_BREAKPOINT_WIDTH = 600;

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
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= TABLET_BREAKPOINT_WIDTH;

  const handleDestinationPress = (destinationSlug: string) => {
    // Convert both origin and destination slugs to uppercase abbreviations
    const fromAbbrev = terminalSlug.toUpperCase();
    const destAbbrev = destinationSlug.toUpperCase();
    void setPair(fromAbbrev, destAbbrev);
    router.push(`/(tabs)/map/${fromAbbrev}/${destAbbrev}` as Href);
  };

  return (
    <View
      className="flex-1 items-center justify-center"
      pointerEvents="box-none"
    >
      <BlurView
        blurTarget={blurTargetRef}
        intensity={12}
        blurMethod="dimezisBlurView"
        className="h-full max-w-full"
        style={{ aspectRatio: 9 / 16, overflow: "visible", borderRadius: 32 }}
      >
        <GlassView className="flex-1 gap-4 rounded-[32px] p-4">
          <View className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl">
            <GlassView className="h-full w-full items-center justify-center bg-gray-200/25">
              <Text className="text-gray-400">Photo Placeholder</Text>
            </GlassView>
          </View>

          <Button
            className="w-full items-center justify-center rounded-full bg-pink-500 hover:bg-pink-400 active:bg-pink-600"
            size="default"
            variant="glass"
          >
            <Text
              className="translate-y-1 pt-2 font-puffberry text-white text-xl leading-none"
              style={{
                textShadowColor: "rgba(0,0,0,0.2)",
                textShadowOffset: { width: 1, height: 2 },
                textShadowRadius: 2,
              }}
            >
              {terminalName}
            </Text>
          </Button>

          <View className="h-full w-full flex-1 items-center justify-center gap-2">
            {destinations.map((destination) => (
              <View key={destination.terminalSlug} className="w-full">
                <Button
                  key={destination.terminalSlug}
                  variant="glass"
                  size="sm"
                  onPress={() =>
                    handleDestinationPress(destination.terminalSlug)
                  }
                  className="w-full rounded-full py-1"
                >
                  <Text
                    className={cn(
                      "font-playpen-600 text-pink-600",
                      isTablet ? "text-sm" : "text-base",
                    )}
                  >
                    → {destination.terminalName}
                  </Text>
                </Button>
              </View>
            ))}
          </View>
        </GlassView>
      </BlurView>
    </View>
  );
};
