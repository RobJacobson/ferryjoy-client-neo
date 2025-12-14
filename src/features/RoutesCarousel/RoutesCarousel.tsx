import { Dimensions, View } from "react-native";
import Carousel from "react-native-reanimated-carousel";
import { getMapEntity, MAP_ENTITIES } from "@/data/mapEntities";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";

const { width, height } = Dimensions.get("window");

export const RoutesCarousel = () => {
  const routes = Object.values(MAP_ENTITIES).filter(
    (e) => e.kind === "route" && (e.terminals?.length ?? 0) > 0
  );

  const processedRoutes = routes
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((route) => {
      const terminals =
        route.terminals?.map((terminalSlug) => {
          const terminalEntity = getMapEntity(terminalSlug);
          return {
            id: terminalSlug,
            name: terminalEntity?.title ?? terminalSlug.toUpperCase(),
          };
        }) ?? [];

      return {
        id: route.slug,
        routeAbbrev: route.slug,
        title: route.title,
        terminals,
      };
    });

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
            <RouteCard
              title={item.title}
              routeAbbrev={item.routeAbbrev}
              terminals={item.terminals}
            />
          </View>
        )}
      />
    </View>
  );
};
