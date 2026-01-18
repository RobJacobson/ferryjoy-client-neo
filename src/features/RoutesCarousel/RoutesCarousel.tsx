import { useEffect, useMemo, useRef } from "react";
import { Dimensions, View } from "react-native";
import type { ICarouselInstance } from "react-native-reanimated-carousel";
import Carousel from "react-native-reanimated-carousel";
import {
  TERMINAL_CONNECTIONS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import { TERMINAL_REGIONS, type TerminalRegion } from "@/data/terminalRegions";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";

const { width, height } = Dimensions.get("window");

interface RoutesCarouselProps {
  /**
   * Selected region filter. When null or "All Terminals", shows all terminals.
   * Otherwise filters to terminals in the selected region.
   */
  selectedRegion?: TerminalRegion | null;
}

/**
 * RoutesCarousel component that displays terminal cards in a carousel.
 * Each card shows a terminal with buttons for all reachable destinations.
 * Uses static terminal connections data to ensure all known terminal pairs
 * are always available, even if temporarily unavailable from the API.
 *
 * @param props - Component props
 * @param props.selectedRegion - Optional region filter to apply to terminal cards
 */
export const RoutesCarousel = ({ selectedRegion }: RoutesCarouselProps) => {
  const carouselRef = useRef<ICarouselInstance>(null);

  // Transform static terminal connections data into card data and filter by region
  const terminalCards = useMemo(() => {
    let cards = transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);

    // Filter by region if a specific region is selected (not "All Terminals" or null)
    if (selectedRegion && selectedRegion !== "All Terminals") {
      const regionTerminalIds = TERMINAL_REGIONS[selectedRegion];
      cards = cards.filter((card) =>
        regionTerminalIds.includes(card.terminalId)
      );
    }

    return cards;
  }, [selectedRegion]);

  // Reset carousel to beginning when region changes
  // This ensures we don't show a blank screen when switching from a region with many terminals
  // to one with fewer terminals (e.g., from index 10 to a list with only 5 items)
  useEffect(() => {
    if (carouselRef.current && terminalCards.length > 0) {
      carouselRef.current.scrollTo({ index: 0, animated: true });
    }
  }, [terminalCards.length]);

  // Use 80% of the screen height, but ensure aspect ratio isn't too wild
  const carouselHeight = height * 0.8;

  return (
    <View className="flex-1 justify-center items-center">
      <Carousel
        key={selectedRegion ?? "all"}
        ref={carouselRef}
        loop={false}
        width={width}
        height={carouselHeight}
        autoPlay={false}
        data={terminalCards}
        scrollAnimationDuration={1000}
        mode="parallax"
        modeConfig={{
          parallaxScrollingScale: 0.9,
          parallaxScrollingOffset: 50,
        }}
        renderItem={({ item }) => (
          <View className="flex-1 px-2 py-4">
            <RouteCard
              terminalName={item.terminalName}
              terminalSlug={item.terminalSlug}
              destinations={item.destinations}
            />
          </View>
        )}
      />
    </View>
  );
};
