/**
 * Native MapComponent implementation
 *
 * This component provides a React Native wrapper around @rnmapbox/maps for native platforms.
 * It manages the map's camera state and synchronizes it with the global MapStateContext.
 * The component handles user interactions like zooming, panning, rotating, and pitch adjustments.
 *
 * @example
 * ```tsx
 * <MapComponent>
 *   <MapMarker coordinate={[-122.3321, 47.6062]} />
 * </MapComponent>
 * ```
 */

import type { Camera, MapState as RNMapState } from "@rnmapbox/maps";
import MapboxRN from "@rnmapbox/maps";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useMapCameraController, useMapState } from "@/data/contexts";
import { MAP_COMPONENT_CONFIG } from "./config";
import type { CameraState, MapProps } from "./shared";
import {
  DEFAULT_NATIVE_CAMERA_STATE,
  handleCameraStateChange,
  nativeMapStateToCameraState,
} from "./shared";
import { useRegisterMapCameraController } from "./useRegisterMapCameraController";

/**
 * Native MapComponent for React Native platforms
 *
 * Renders a Mapbox map with camera controls and state management.
 * Updates the global map state context when the user interacts with the map.
 *
 * @param props - Component props
 * @param props.children - Child components to render within the map (markers, overlays, etc.)
 * @param props.initialCameraState - Initial camera state for the map (optional)
 * @returns A React Native View containing the Mapbox map
 */
export const MapComponent = ({ children, initialCameraState }: MapProps) => {
  // Only use update function from context, not the state
  const { updateCameraState, updateMapDimensions } = useMapState();
  const { registerController } = useMapCameraController();

  // Keep track of previous camera state to avoid unnecessary updates
  const previousCameraStateRef = useRef<CameraState>(
    initialCameraState || DEFAULT_NATIVE_CAMERA_STATE
  );

  const cameraRef = useRef<Camera>(null);

  /**
   * Handles camera change events from Mapbox map
   *
   * Converts native MapState to our canonical CameraState format
   * and updates the global map state context.
   *
   * @param state - The MapState object from @rnmapbox/maps
   */
  const handleCameraChanged = (state: RNMapState) => {
    const newCameraState = nativeMapStateToCameraState(state);
    handleCameraStateChange(
      newCameraState,
      previousCameraStateRef,
      updateCameraState
    );
  };

  // Update map dimensions when component mounts
  useEffect(() => {
    // For native, we'll use default dimensions that should be updated
    // by the actual map layout when available
    updateMapDimensions({ width: 375, height: 812 }); // iPhone X dimensions as default
  }, [updateMapDimensions]);

  // Register imperative camera controller for screens to call flyTo
  const flyToImpl = (target: CameraState, durationMs: number) => {
    cameraRef.current?.setCamera({
      centerCoordinate: [...target.centerCoordinate] as [number, number],
      zoomLevel: target.zoomLevel,
      heading: target.heading,
      pitch: target.pitch,
      animationDuration: durationMs,
      animationMode: durationMs > 0 ? "flyTo" : "none",
    });
  };

  useRegisterMapCameraController({
    registerController,
    updateCameraState,
    flyToImpl,
    defaultDurationMs: 800,
  });

  return (
    <View className="relative flex-1">
      <MapboxRN.MapView
        style={{ flex: 1 }}
        styleURL={MAP_COMPONENT_CONFIG.styleURL}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        onCameraChanged={handleCameraChanged}
      >
        <MapboxRN.Camera
          ref={cameraRef}
          defaultSettings={{
            ...(initialCameraState || DEFAULT_NATIVE_CAMERA_STATE),
            centerCoordinate: [
              ...(initialCameraState || DEFAULT_NATIVE_CAMERA_STATE)
                .centerCoordinate,
            ] as [number, number],
          }}
        />
        {children}
      </MapboxRN.MapView>
    </View>
  );
};
