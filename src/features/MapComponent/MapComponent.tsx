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
import { useRef } from "react";
import { View } from "react-native";
import { useMapState } from "@/shared/contexts";
import type { MapProps } from "./shared";
import { nativeMapStateToCameraState } from "./shared";

/**
 * Native MapComponent for React Native platforms
 *
 * Renders a Mapbox map with camera controls and state management.
 * Automatically updates the global map state when the user interacts with the map.
 *
 * @param props - Component props
 * @param props.children - Child components to render within the map (markers, overlays, etc.)
 * @returns A React Native View containing the Mapbox map
 */
export const MapComponent = ({ children }: MapProps) => {
  const { cameraState, mapStyle, updateCameraState } = useMapState();
  const previousCameraStateRef = useRef(cameraState);

  /**
   * Handles camera change events from Mapbox map
   *
   * Converts the native MapState to our canonical CameraState format
   * and updates the global map state context.
   *
   * @param state - The MapState object from @rnmapbox/maps
   */
  const handleCameraChanged = (state: RNMapState) => {
    const newCameraState = nativeMapStateToCameraState(state);

    // Only update if the camera state has actually changed
    if (
      newCameraState.centerCoordinate[0] !==
        previousCameraStateRef.current.centerCoordinate[0] ||
      newCameraState.centerCoordinate[1] !==
        previousCameraStateRef.current.centerCoordinate[1] ||
      newCameraState.zoomLevel !== previousCameraStateRef.current.zoomLevel ||
      newCameraState.heading !== previousCameraStateRef.current.heading ||
      newCameraState.pitch !== previousCameraStateRef.current.pitch
    ) {
      updateCameraState(newCameraState);
      previousCameraStateRef.current = newCameraState;
    }
  };

  return (
    <View className="flex-1 relative">
      <MapboxRN.MapView
        style={{ flex: 1 }}
        styleURL={mapStyle}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        onCameraChanged={handleCameraChanged}
      >
        <MapboxRN.Camera
          defaultSettings={{
            ...cameraState,
            centerCoordinate: [...cameraState.centerCoordinate] as [
              number,
              number,
            ],
          }}
        />
        {children}
      </MapboxRN.MapView>
    </View>
  );
};
