/**
 * Shared constants and utilities used across the application
 *
 * This module provides shared constants, utilities, and camera state management for MapComponent.
 * It defines the canonical CameraState type used across the application and provides conversion
 * functions between different map library formats.
 */

import type { MapState as RNMapState } from "@rnmapbox/maps";
import type { ViewState } from "react-map-gl/mapbox";

/**
 * Maximum pitch value allowed for Mapbox maps
 * @constant {number}
 * @default 75
 */
const MAX_PITCH = 75;

/**
 * Our CameraState type (canonical format)
 *
 * This is the standard camera state format used across the application. It provides
 * a unified representation of the map's camera position regardless of the underlying
 * map implementation (native or web).
 *
 * @typedef {Object} CameraState
 * @property {readonly [number, number]} centerCoordinate - The center coordinates as [longitude, latitude]
 * @property {number} zoomLevel - The current zoom level
 * @property {number} heading - The compass heading/bearing in degrees (0-360)
 * @property {number} pitch - The tilt angle in degrees (0-90, where 0 is directly overhead)
 */
export type CameraState = {
  centerCoordinate: readonly [number, number];
  zoomLevel: number;
  heading: number;
  pitch: number;
};

export const DEFAULT_NATIVE_CAMERA_STATE: CameraState = {
  centerCoordinate: [
    -122.3321, // Seattle longitude
    47.6062, // Seattle latitude
  ],
  zoomLevel: 12,
  pitch: 45,
  heading: 0,
} as const;

/**
 * Validates and clamps pitch value to valid range
 *
 * Ensures that the pitch value is within the valid range for Mapbox maps.
 * If the pitch is undefined or null, returns the default value of 45 degrees.
 *
 * @param {number | undefined} pitch - The pitch value to validate
 * @returns {number} The validated and clamped pitch value
 */
const clampPitch = (pitch: number | undefined): number => {
  if (pitch === undefined || pitch === null) {
    return 45; // Default pitch value
  }
  // Clamp pitch to valid range (0-MAX_PITCH degrees)
  return Math.max(0, Math.min(MAX_PITCH, pitch));
};

/**
 * Adapter function for native MapState events
 *
 * Converts @rnmapbox/maps MapState to our canonical CameraState format.
 * This function is used to transform camera state events from the native map
 * implementation into our standardized format.
 *
 * @param {RNMapState} state - The MapState object from @rnmapbox/maps
 * @returns {CameraState} The camera state in our canonical format

 */
export const nativeMapStateToCameraState = (
  state: RNMapState
): CameraState => ({
  centerCoordinate: [state.properties.center[0], state.properties.center[1]],
  zoomLevel: state.properties.zoom,
  heading: state.properties.heading,
  pitch: clampPitch(state.properties.pitch),
});

/**
 * Adapter function for web ViewState events
 *
 * Converts react-map-gl ViewState to our canonical CameraState format.
 * This function is used to transform camera state events from the web map
 * implementation into our standardized format.
 *
 * @param {ViewState} viewState - The ViewState object from react-map-gl
 * @returns {CameraState} The camera state in our canonical format
 */
export const webViewStateToCameraState = (
  viewState: ViewState
): CameraState => ({
  centerCoordinate: [viewState.longitude, viewState.latitude],
  zoomLevel: viewState.zoom,
  heading: viewState.bearing || 0,
  pitch: clampPitch(viewState.pitch),
});

/**
 * Adapter function for converting CameraState to web ViewState
 *
 * Converts our canonical CameraState format to react-map-gl ViewState.
 * This function is used to transform our standardized camera state
 * into the format expected by the web map implementation.
 *
 * @param {CameraState} cameraState - The camera state in our canonical format
 * @returns {ViewState} The ViewState object for react-map-gl
 */
export const cameraStateToViewState = (
  cameraState: CameraState
): ViewState => ({
  longitude: cameraState.centerCoordinate[0],
  latitude: cameraState.centerCoordinate[1],
  zoom: cameraState.zoomLevel,
  pitch: cameraState.pitch,
  bearing: cameraState.heading,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
});

/**
 * Map style URLs
 */
export const MAP_STYLES = {
  STREETS: "mapbox://styles/mapbox/streets-v12",
  OUTDOORS: "mapbox://styles/mapbox/outdoors-v12",
  LIGHT: "mapbox://styles/mapbox/light-v11",
  DARK: "mapbox://styles/mapbox/dark-v11",
  SATELLITE: "mapbox://styles/mapbox/satellite-v9",
  SATELLITE_STREETS: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;

/**
 * Default map style
 */
export const DEFAULT_MAP_STYLE = MAP_STYLES.STREETS;

/**
 * Map component props type
 */
export type MapProps = {
  children?: React.ReactNode;
  initialCameraState?: CameraState;
};

/**
 * Throttling utility function to limit the frequency of function calls
 *
 * This utility can be used to throttle rapid events like map pan/zoom to improve performance.
 * It ensures the function is called at most once per specified delay period.
 *
 * @param func - The function to throttle
 * @param delay - The delay in milliseconds between function calls
 * @returns A throttled version of the function
 *
 * @example
 * ```tsx
 * const throttledUpdate = useThrottle((newState) => {
 *   updateCameraState(newState);
 * }, 100);
 * ```
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecTime = 0;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(
        () => {
          func(...args);
          lastExecTime = Date.now();
          timeoutId = null;
        },
        delay - (currentTime - lastExecTime)
      );
    }
  };
};

/**
 * Handles camera state changes for both native and web map components
 *
 * This function checks if the camera state has actually changed and updates the context
 * if it has. It returns a boolean indicating whether an update was performed.
 *
 * @param newCameraState - The new camera state from the map
 * @param previousCameraStateRef - Ref to the previous camera state
 * @param updateCameraState - Function to update the context
 * @returns True if the camera state was updated, false otherwise
 */
export const handleCameraStateChange = (
  newCameraState: CameraState,
  previousCameraStateRef: React.MutableRefObject<CameraState>,
  updateCameraState: (cameraState: CameraState) => void
): void => {
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
    // Update context state continuously
    updateCameraState(newCameraState);

    // Update the previous state reference
    previousCameraStateRef.current = newCameraState;
  }
};
