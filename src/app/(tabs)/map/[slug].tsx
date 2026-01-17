import { Redirect, useLocalSearchParams, usePathname } from "expo-router";
import { useMapCameraController, useNavigationHistory } from "@/data/contexts";
import { getMapEntity, MAP_NAV_CONFIG } from "@/data/mapEntities";
import { getTerminalLocationByAbbrev } from "@/data/terminalLocations";
import type { CameraState } from "@/features/MapComponent/shared";
import { useMapSlugCameraAnimation } from "@/features/MapNavigation/useMapSlugCameraAnimation";
import { MapScreenLayout } from "@/features/MapScreen";
import { TerminalOrRouteBottomSheet } from "@/features/TerminalOrRouteBottomSheet/TerminalOrRouteBottomSheet";

/**
 * Create camera state for a terminal at zoom level 9.
 *
 * @param terminal - Terminal location data
 * @returns Camera state targeting the terminal
 */
const createTerminalCameraState = (
  terminal: ReturnType<typeof getTerminalLocationByAbbrev>
): CameraState | null => {
  if (!terminal) return null;
  return {
    centerCoordinate: [terminal.Longitude, terminal.Latitude],
    zoomLevel: 9,
    heading: 0,
    pitch: 60,
  };
};

const MapSlugPage = () => {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { controller } = useMapCameraController();
  const { previousPathname } = useNavigationHistory();
  const pathname = usePathname();

  const slugStr = (slug || "").toString();

  // First, try to find existing map entity (for lowercase slugs like "p52", "sea-bi", etc.)
  const entity = getMapEntity(slugStr);

  // If no entity found, check if it's an uppercase terminal abbreviation
  const terminal = !entity ? getTerminalLocationByAbbrev(slugStr) : null;

  const cameraState: CameraState | null =
    entity?.camera ?? (terminal ? createTerminalCameraState(terminal) : null);
  const title = entity?.title ?? (terminal ? terminal.TerminalName : "Map");
  const kind: "terminal" | "route" = entity?.kind ?? "terminal";

  useMapSlugCameraAnimation({
    controller,
    pathname,
    previousPathname,
    entityCamera: cameraState,
    startCamera: MAP_NAV_CONFIG.startCamera,
    flyTo: MAP_NAV_CONFIG.flyTo,
  });

  if (!cameraState) {
    return <Redirect href="/+not-found" />;
  }

  return (
    <MapScreenLayout
      title={title}
      bottomSheet={
        <TerminalOrRouteBottomSheet
          title={title}
          kind={kind}
          snapPoints={MAP_NAV_CONFIG.bottomSheet.snapPoints}
          initialIndex={MAP_NAV_CONFIG.bottomSheet.initialIndex}
        />
      }
    />
  );
};

export default MapSlugPage;
