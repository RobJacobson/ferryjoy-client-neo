import {
  Redirect,
  Stack,
  useLocalSearchParams,
  usePathname,
} from "expo-router";
import { View } from "react-native";
import {
  SmoothedVesselLocationsProvider,
  useMapCameraController,
  useMapState,
  useNavigationHistory,
} from "@/data/contexts";
import { getMapEntity, MAP_NAV_CONFIG } from "@/data/mapEntities";
import { MapComponent } from "@/features/MapComponent";
import { MapDebugOverlay } from "@/features/MapDebugOverlay/MapDebugOverlay";
import { useMapSlugCameraAnimation } from "@/features/MapNavigation/useMapSlugCameraAnimation";
import { TerminalOrRouteBottomSheet } from "@/features/TerminalOrRouteBottomSheet/TerminalOrRouteBottomSheet";
import { VesselCircleMarkers } from "@/features/VesselCircleMarkers";
import { VesselLines } from "@/features/VesselLines";

const MapSlugPage = () => {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { cameraState } = useMapState();
  const { controller } = useMapCameraController();
  const { previousPathname } = useNavigationHistory();
  const pathname = usePathname();

  const slugStr = (slug || "").toString();
  const entity = getMapEntity(slugStr);

  const title = entity?.title ?? "Map";

  useMapSlugCameraAnimation({
    controller,
    pathname,
    previousPathname,
    entityCamera: entity?.camera ?? null,
    startCamera: MAP_NAV_CONFIG.startCamera,
    flyTo: MAP_NAV_CONFIG.flyTo,
  });

  if (!entity) {
    return <Redirect href="/+not-found" />;
  }

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title }} />
      <MapComponent initialCameraState={cameraState}>
        <SmoothedVesselLocationsProvider>
          <VesselLines />
          {/* Terminal/route-specific interaction (flyTo + bottom sheet) added in later steps */}
          <VesselCircleMarkers onVesselSelect={() => {}} />
        </SmoothedVesselLocationsProvider>
      </MapComponent>
      <MapDebugOverlay />
      <TerminalOrRouteBottomSheet
        title={title}
        kind={entity.kind}
        snapPoints={MAP_NAV_CONFIG.bottomSheet.snapPoints}
        initialIndex={MAP_NAV_CONFIG.bottomSheet.initialIndex}
      />
    </View>
  );
};

export default MapSlugPage;
