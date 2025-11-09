/**
 * Camera state utilities for MapComponent
 * Handles camera state management and platform-specific adapters
 */

import type { MapState } from "@rnmapbox/maps"
import type { ViewState } from "react-map-gl/mapbox"

const MAX_PITCH = 75 // Max pitch value for Mapbox

/**
 * Native camera state type (canonical format)
 * Used as the standard format across the application
 */
export type CameraState = {
  centerCoordinate: readonly [number, number]
  zoomLevel: number
  heading: number
  pitch: number
}

/**
 * Validate and clamp pitch value to valid range
 */
const validatePitch = (pitch: number | undefined): number => {
  if (pitch === undefined || pitch === null) {
    return 45 // Default pitch value
  }
  // Clamp pitch to valid range (0-MAX_PITCH degrees)
  return Math.max(0, Math.min(MAX_PITCH, pitch))
}

/**
 * Convert native camera state to web view state format for react-map-gl
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
 * Converts @rnmapbox/maps MapState to CameraState format
 */
export const nativeMapStateToCameraState = (state: MapState): CameraState => ({
  centerCoordinate: [state.properties.center[0], state.properties.center[1]],
  zoomLevel: state.properties.zoom,
  heading: state.properties.heading,
  pitch: validatePitch(state.properties.pitch),
})

/**
 * Adapter function for web ViewState events
 * Converts react-map-gl ViewState to CameraState format
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
 * Shared camera state change handler
 * Used by both native and web MapComponents to handle camera state updates
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

