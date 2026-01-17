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
import { useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
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
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });

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

  /**
   * Handles layout changes to measure actual container dimensions
   *
   * This ensures Mapbox receives valid dimensions before initialization,
   * preventing the "Invalid size" error on iOS.
   *
   * @param event - Layout change event with dimensions
   */
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setMapDimensions({ width, height });
      updateMapDimensions({ width, height });
    }
  };

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

  // Only render MapView after we have valid dimensions to prevent iOS initialization errors
  const hasValidDimensions =
    mapDimensions.width > 0 && mapDimensions.height > 0;

  return (
    <View className="relative flex-1" onLayout={handleLayout}>
      {hasValidDimensions ? (
        <MapboxRN.MapView
          style={{ flex: 1 }}
          styleURL={MAP_COMPONENT_CONFIG.styleURL}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          onCameraChanged={handleCameraChanged}
          onDidFinishLoadingStyle={() => setStyleLoaded(true)}
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
          {styleLoaded ? children : null}
        </MapboxRN.MapView>
      ) : null}
    </View>
  );
};
