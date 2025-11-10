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

import type { MapState as RNMapState } from "@rnmapbox/maps";
import MapboxRN from "@rnmapbox/maps";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useMapState } from "@/shared/contexts";
import type { CameraState, MapProps } from "./shared";
import {
  DEFAULT_NATIVE_CAMERA_STATE,
  handleCameraStateChange,
  nativeMapStateToCameraState,
} from "./shared";

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

  // Keep track of previous camera state to avoid unnecessary updates
  const previousCameraStateRef = useRef<CameraState>(
    initialCameraState || DEFAULT_NATIVE_CAMERA_STATE
  );

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

  return (
    <View className="flex-1 relative">
      <MapboxRN.MapView
        style={{ flex: 1 }}
        styleURL="mapbox://styles/mapbox/streets-v12"
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        onCameraChanged={handleCameraChanged}
      >
        <MapboxRN.Camera
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
