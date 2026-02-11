/**
 * Map route handler for terminal pair navigation.
 *
 * Handles routes in the format /map/[from]/[dest] where:
 * - [from] is the departing terminal abbreviation (case-insensitive, e.g., "P52" or "p52")
 * - [dest] is the arriving terminal abbreviation (case-insensitive, optional)
 *
 * The map will zoom to the departing terminal's GPS coordinates at zoom level 9.
 */

import { Redirect, useLocalSearchParams, usePathname } from "expo-router";
import { useEffect } from "react";
import {
  useMapCameraController,
  useNavigationHistory,
  useSelectedTerminalPair,
} from "@/data/contexts";
import { MAP_NAV_CONFIG } from "@/data/mapEntities";
import {
  getTerminalLocationByAbbrev,
  type TerminalLocation,
} from "@/data/terminalLocations";
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
const createTerminalCameraState = (terminal: TerminalLocation): CameraState => {
  return {
    centerCoordinate: [terminal.Longitude, terminal.Latitude],
    zoomLevel: 9,
    heading: 0,
    pitch: 60,
  };
};

/**
 * Generate title for the map view based on terminal pair.
 *
 * @param fromTerminal - Departing terminal location
 * @param destTerminal - Arriving terminal location (optional)
 * @returns Title string for the map view
 */
const generateTitle = (
  fromTerminal: TerminalLocation,
  destTerminal: TerminalLocation | null
): string => {
  if (destTerminal) {
    return `${fromTerminal.TerminalName} to ${destTerminal.TerminalName}`;
  }
  return fromTerminal.TerminalName;
};

const MapTerminalPairPage = () => {
  const { from, dest } = useLocalSearchParams<{
    from: string;
    dest?: string;
  }>();
  const { controller } = useMapCameraController();
  const { previousPathname } = useNavigationHistory();
  const { setPair } = useSelectedTerminalPair();
  const pathname = usePathname();

  // Extract and normalize terminal abbreviations
  const fromAbbrev = (from || "").toString();
  const destAbbrev = dest ? dest.toString() : null;

  // Look up terminal locations (case-insensitive)
  const fromTerminal = fromAbbrev
    ? getTerminalLocationByAbbrev(fromAbbrev)
    : null;
  const destTerminal = destAbbrev
    ? getTerminalLocationByAbbrev(destAbbrev)
    : null;

  // Create camera state for departing terminal at zoom 9 (null if terminal not found)
  const cameraState = fromTerminal
    ? createTerminalCameraState(fromTerminal)
    : null;

  // Generate title (fallback if terminal not found)
  const title = fromTerminal
    ? generateTitle(fromTerminal, destTerminal)
    : "Map";

  useEffect(() => {
    if (!fromTerminal || !destTerminal) {
      return;
    }
    void setPair(fromTerminal.TerminalAbbrev, destTerminal.TerminalAbbrev);
  }, [destTerminal, fromTerminal, setPair]);

  // Use existing camera animation hook (must be called unconditionally)
  useMapSlugCameraAnimation({
    controller,
    pathname,
    previousPathname,
    entityCamera: cameraState,
    startCamera: MAP_NAV_CONFIG.startCamera,
    flyTo: MAP_NAV_CONFIG.flyTo,
  });

  // If departing terminal not found, redirect to not-found
  if (!fromTerminal) {
    return <Redirect href="/+not-found" />;
  }

  return (
    <>
      <MapScreenLayout
        bottomSheet={
          <TerminalOrRouteBottomSheet
            title={title}
            kind="terminal"
            snapPoints={MAP_NAV_CONFIG.bottomSheet.snapPoints}
            initialIndex={MAP_NAV_CONFIG.bottomSheet.initialIndex}
          />
        }
      />
    </>
  );
};

export default MapTerminalPairPage;
