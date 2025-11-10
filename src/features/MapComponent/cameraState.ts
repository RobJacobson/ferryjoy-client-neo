/**
 * Camera state utilities for MapComponent
 *
 * This module provides utilities for handling camera state management and platform-specific adapters.
 * It defines the canonical CameraState type used across the application and provides conversion
 * functions between different map library formats.
 *
 * @fileoverview Camera state management and conversion utilities
 */

import type { MapState as RNMapState } from "@rnmapbox/maps"
import type { ViewState } from "react-map-gl/mapbox"

import { DEFAULT_CAMERA_STATE } from "@/features/MapComponent/shared"

/**
 * Maximum pitch value allowed for Mapbox maps
 * @constant {number}
 * @default 75
 */
const MAX_PITCH = 75

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
  centerCoordinate: readonly [number, number]
  zoomLevel: number
  heading: number
  pitch: number
}

/**
 * Validates and clamps pitch value to valid range
 *
 * Ensures that the pitch value is within the valid range for Mapbox maps.
 * If the pitch is undefined or null, returns the default value of 45 degrees.
 *
 * @param {number | undefined} pitch - The pitch value to validate
 * @returns {number} The validated and clamped pitch value
 *
 * @example
 * ```typescript
 * validatePitch(80) // Returns 75 (clamped to max)
 * validatePitch(-10) // Returns 0 (clamped to min)
 * validatePitch(30) // Returns 30 (within range)
 * validatePitch(undefined) // Returns 45 (default value)
 * ```
 */
const validatePitch = (pitch: number | undefined): number => {
  if (pitch === undefined || pitch === null) {
    return 45 // Default pitch value
  }
  // Clamp pitch to valid range (0-MAX_PITCH degrees)
  return Math.max(0, Math.min(MAX_PITCH, pitch))
}

/**
 * Converts our CameraState format to react-map-gl view state format
 *
 * This function transforms the canonical CameraState to the format expected by
 * react-map-gl's ViewState interface. It's used when setting the initial view state
 * for web maps.
 *
 * @param {CameraState} cameraState - The camera state in our canonical format
 * @returns {Object} The view state object compatible with react-map-gl
 * @returns {number} returns.longitude - The longitude coordinate
 * @returns {number} returns.latitude - The latitude coordinate
 * @returns {number} returns.zoom - The zoom level
 * @returns {number} returns.bearing - The compass bearing in degrees
 * @returns {number} returns.pitch - The tilt angle in degrees
 * @returns {Object} returns.padding - The padding object (all zeros)
 * @returns {number} returns.width - The viewport width (default 800)
 * @returns {number} returns.height - The viewport height (default 600)
 *
 * @example
 * ```typescript
 * const cameraState = {
 *   centerCoordinate: [-122.3321, 47.6062],
 *   zoomLevel: 12,
 *   heading: 0,
 *   pitch: 45
 * };
 *
 * const viewState = toWebViewState(cameraState);
 * // Returns: {
 * //   longitude: -122.3321,
 * //   latitude: 47.6062,
 * //   zoom: 12,
 * //   bearing: 0,
 * //   pitch: 45,
 * //   padding: { top: 0, bottom: 0, left: 0, right: 0 },
 * //   width: 800,
 * //   height: 600
 * // }
 * ```
 */
export const toWebViewState = (cameraState: CameraState) => ({
  longitude: cameraState.centerCoordinate[0],
  latitude: cameraState.centerCoordinate[1],
  zoom: cameraState.zoomLevel,
  bearing: cameraState.heading,
  pitch: cameraState.pitch,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
  width: 800,
  height: 600,
})

/**
 * Adapter function for native MapState events
 *
 * Converts @rnmapbox/maps MapState to our canonical CameraState format.
 * This function is used to transform camera state events from the native map
 * implementation into our standardized format.
 *
 * @param {RNMapState} state - The MapState object from @rnmapbox/maps
 * @returns {CameraState} The camera state in our canonical format
 *
 * @example
 * ```typescript
 * // Handling a native map camera change event
 * const handleCameraChanged = (nativeState) => {
 *   const cameraState = nativeMapStateToCameraState(nativeState);
 *   // Use cameraState in our application
 *   updateMapState(cameraState);
 * };
 * ```
 */
export const nativeMapStateToCameraState = (
  state: RNMapState
): CameraState => ({
  centerCoordinate: [state.properties.center[0], state.properties.center[1]],
  zoomLevel: state.properties.zoom,
  heading: state.properties.heading,
  pitch: validatePitch(state.properties.pitch),
})

/**
 * Adapter function for web ViewState events
 *
 * Converts react-map-gl ViewState to our canonical CameraState format.
 * This function is used to transform camera state events from the web map
 * implementation into our standardized format.
 *
 * @param {ViewState} viewState - The ViewState object from react-map-gl
 * @returns {CameraState} The camera state in our canonical format
 *
 * @example
 * ```typescript
 * // Handling a web map camera change event
 * const handleMove = (event) => {
 *   const cameraState = webViewStateToCameraState(event.viewState);
 *   // Use cameraState in our application
 *   updateMapState(cameraState);
 * };
 * ```
 */
export const webViewStateToCameraState = (
  viewState: ViewState
): CameraState => ({
  centerCoordinate: [viewState.longitude, viewState.latitude],
  zoomLevel: viewState.zoom,
  heading: viewState.bearing || 0,
  pitch: validatePitch(viewState.pitch),
})

/**
 * Creates a shared camera state change handler
 *
 * This factory function creates a handler that can be used by both native and web
 * MapComponents to handle camera state updates. It centralizes the logic for
 * updating the global map state and optionally calling a user-provided callback.
 *
 * @param {(cameraState: CameraState) => void} updateCameraState - Function to update the global camera state
 * @param {(cameraState: CameraState) => void} [onCameraStateChange] - Optional callback for camera state changes
 * @returns {(cameraState: CameraState) => void} A function that handles camera state changes
 *
 * @example
 * ```typescript
 * // In a map component
 * const { updateCameraState } = useMapState();
 *
 * const handleCameraChange = createCameraStateHandler(
 *   updateCameraState,
 *   (state) => console.log('Camera changed:', state)
 * );
 *
 * // Use with map events
 * <MapView onCameraChanged={handleCameraChange} />
 * ```
 */
export const createCameraStateHandler = (
  updateCameraState: (cameraState: CameraState) => void,
  onCameraStateChange?: (cameraState: CameraState) => void
) => {
  return (cameraState: CameraState) => {
    updateCameraState(cameraState)
    onCameraStateChange?.(cameraState)
  }
}
