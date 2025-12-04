import { useMemo } from "react";
import { Dimensions, View } from "react-native";
import Carousel from "react-native-reanimated-carousel";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";

// Import data directly
import routesData from "../../../assets/wsf-data/wsf-routes.json";

const { width, height } = Dimensions.get("window");

export const RoutesCarousel = () => {
  const processedRoutes = useMemo(() => {
    const routes = Object.values(routesData.routes);
    const terminalLookup = routesData.terminalLookup;

    // Filter out the routes we want to combine (13, 14, 15)
    const standardRoutes = routes.filter(
      (r) => ![13, 14, 15].includes(r.routeId)
    );

    // Create the combined route
    const combinedRoute = {
      routeId: 999, // Custom ID
      description: "Southworth / Vashon / Fauntleroy",
      terminals: ["FAU", "SOU", "VAI"],
    };

    // Combine and format for the card
    const allRoutes = [...standardRoutes, combinedRoute];

    return allRoutes.map((route) => {
      const terminals = route.terminals.map((tId) => ({
        id: tId,
        name:
          terminalLookup[tId as keyof typeof terminalLookup]?.terminalName ||
          tId,
      }));

      return {
        id: route.routeId,
        title: route.description,
        terminals,
      };
    });
  }, []);

  // Use 80% of the screen height, but ensure aspect ratio isn't too wild
  const carouselHeight = height * 0.8;

  return (
    <View className="flex-1 justify-center items-center">
      <Carousel
        loop={false}
        width={width}
        height={carouselHeight}
        autoPlay={false}
        data={processedRoutes}
        scrollAnimationDuration={1000}
        mode="parallax"
        modeConfig={{
          parallaxScrollingScale: 0.9,
          parallaxScrollingOffset: 50,
        }}
        renderItem={({ item }) => (
          <View className="flex-1 px-2 py-4">
            <RouteCard title={item.title} terminals={item.terminals} />
          </View>
        )}
      />
    </View>
  );
};
