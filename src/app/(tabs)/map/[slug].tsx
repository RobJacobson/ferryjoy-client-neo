import {
  Redirect,
  useLocalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import { useEffect } from "react";
import {
  useMapCameraController,
  useNavigationHistory,
  useSelectedTerminalPair,
} from "@/data/contexts";
import { getMapEntity, MAP_NAV_CONFIG } from "@/data/mapEntities";
import { getTerminalLocationByAbbrev } from "@/data/terminalLocations";
import type { CameraState } from "@/features/MapFeatures/MapComponent/shared";
import { useMapSlugCameraAnimation } from "@/features/MapFeatures/MapNavigation/useMapSlugCameraAnimation";
import { MapScreenLayout } from "@/features/MapFeatures/MapScreen";
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
  const router = useRouter();
  const { clear, setAll } = useSelectedTerminalPair();

  const slugStr = (slug || "").toString();

  // First, try to find existing map entity (for lowercase slugs like "p52", "sea-bi", etc.)
  const entity = getMapEntity(slugStr);

  // If no entity found, check if it's an uppercase terminal abbreviation
  const terminal = !entity ? getTerminalLocationByAbbrev(slugStr) : null;

  const terminalMates = terminal?.TerminalMates ?? [];

  const cameraState: CameraState | null =
    entity?.camera ?? (terminal ? createTerminalCameraState(terminal) : null);

  const title = entity?.title
    ? entity.title
    : terminal
      ? terminalMates.length >= 2
        ? `${terminal.TerminalName} (all terminals)`
        : terminal.TerminalName
      : "Map";
  const kind: "terminal" | "route" = entity?.kind ?? "terminal";

  useEffect(() => {
    if (entity || !terminal) {
      return;
    }

    if (terminalMates.length === 0) {
      void clear();
      router.replace("/");
      return;
    }

    if (terminalMates.length === 1) {
      const onlyMate = terminalMates[0];
      router.replace(`/(tabs)/map/${terminal.TerminalAbbrev}/${onlyMate}`);
      return;
    }

    void setAll(terminal.TerminalAbbrev);
  }, [clear, entity, router, setAll, terminal, terminalMates]);

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
    <>
      <MapScreenLayout
        bottomSheet={
          <TerminalOrRouteBottomSheet
            title={title}
            kind={kind}
            snapPoints={MAP_NAV_CONFIG.bottomSheet.snapPoints}
            initialIndex={MAP_NAV_CONFIG.bottomSheet.initialIndex}
          />
        }
      />
    </>
  );
};

export default MapSlugPage;
