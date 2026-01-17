import { Dimensions, View } from "react-native";
import Carousel from "react-native-reanimated-carousel";
import {
  TERMINAL_CONNECTIONS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";

const { width, height } = Dimensions.get("window");

/**
 * RoutesCarousel component that displays terminal cards in a carousel.
 * Each card shows a terminal with buttons for all reachable destinations.
 * Uses static terminal connections data to ensure all known terminal pairs
 * are always available, even if temporarily unavailable from the API.
 */
export const RoutesCarousel = () => {
  // Transform static terminal connections data into card data
  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);

  // Use 80% of the screen height, but ensure aspect ratio isn't too wild
  const carouselHeight = height * 0.8;

  return (
    <View className="flex-1 justify-center items-center">
      <Carousel
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
