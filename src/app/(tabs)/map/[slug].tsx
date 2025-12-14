import { Redirect, useLocalSearchParams, usePathname } from "expo-router";
import { useMapCameraController, useNavigationHistory } from "@/data/contexts";
import { getMapEntity, MAP_NAV_CONFIG } from "@/data/mapEntities";
import { useMapSlugCameraAnimation } from "@/features/MapNavigation/useMapSlugCameraAnimation";
import { MapScreenLayout } from "@/features/MapScreen";
import { TerminalOrRouteBottomSheet } from "@/features/TerminalOrRouteBottomSheet/TerminalOrRouteBottomSheet";

const MapSlugPage = () => {
  const { slug } = useLocalSearchParams<{ slug: string }>();
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
    <MapScreenLayout
      title={title}
      bottomSheet={
        <TerminalOrRouteBottomSheet
          title={title}
          kind={entity.kind}
          snapPoints={MAP_NAV_CONFIG.bottomSheet.snapPoints}
          initialIndex={MAP_NAV_CONFIG.bottomSheet.initialIndex}
        />
      }
    />
  );
};

export default MapSlugPage;
