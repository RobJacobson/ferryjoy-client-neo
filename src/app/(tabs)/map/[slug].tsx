import { useFocusEffect } from "@react-navigation/native";
import {
  Redirect,
  Stack,
  useLocalSearchParams,
  usePathname,
} from "expo-router";
import { useCallback, useRef } from "react";
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
import { TerminalOrRouteBottomSheet } from "@/features/TerminalOrRouteBottomSheet/TerminalOrRouteBottomSheet";
import { VesselCircleMarkers } from "@/features/VesselCircleMarkers";
import { VesselLines } from "@/features/VesselLines";

const MapSlugPage = () => {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { cameraState } = useMapState();
  const { controller } = useMapCameraController();
  const { previousPathname } = useNavigationHistory();
  const pathname = usePathname();
  const lastAnimatedPathRef = useRef<string | null>(null);
  const pendingAnimationPathRef = useRef<string | null>(null);
  const flyToTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slugStr = (slug || "").toString();
  const entity = getMapEntity(slugStr);

  const title = entity?.title ?? "Map";

  const shouldAnimateFromPrevious = useCallback((prev: string | null) => {
    if (!prev) return true;
    if (prev === "/" || prev === "/index") return true;
    // Animate if transitioning within the map stack (including /map index)
    return prev.includes("/map");
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Reset on blur so back-navigation can animate again
      return () => {
        if (flyToTimeoutRef.current) {
          clearTimeout(flyToTimeoutRef.current);
          flyToTimeoutRef.current = null;
        }
        pendingAnimationPathRef.current = null;
        lastAnimatedPathRef.current = null;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!controller) return;
      if (!slugStr) return;
      if (!entity) return;
      if (!shouldAnimateFromPrevious(previousPathname)) return;

      if (lastAnimatedPathRef.current === pathname) return;
      if (pendingAnimationPathRef.current === pathname) return;

      const targetZoom =
        MAP_NAV_CONFIG.flyTo.targetZoomOverride ?? entity.camera.zoomLevel;
      const targetCamera = {
        ...entity.camera,
        zoomLevel: targetZoom,
      };

      // Cancel any in-flight scheduled animation (e.g. rerenders while focused)
      if (flyToTimeoutRef.current) {
        clearTimeout(flyToTimeoutRef.current);
        flyToTimeoutRef.current = null;
      }

      // Ensure the user actually sees the transition: snap to a Seattle overview first,
      // then animate to the target.
      pendingAnimationPathRef.current = pathname;
      controller.flyTo(MAP_NAV_CONFIG.startCamera, { durationMs: 0 });
      flyToTimeoutRef.current = setTimeout(() => {
        controller.flyTo(targetCamera, {
          durationMs: MAP_NAV_CONFIG.flyTo.durationMs,
        });
        lastAnimatedPathRef.current = pathname;
        pendingAnimationPathRef.current = null;
        flyToTimeoutRef.current = null;
      }, MAP_NAV_CONFIG.flyTo.delayMs);
    }, [
      controller,
      entity,
      pathname,
      previousPathname,
      shouldAnimateFromPrevious,
      slugStr,
    ])
  );

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
