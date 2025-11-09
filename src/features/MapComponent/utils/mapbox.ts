/**
 * Enhanced mapbox utilities for platform-specific functionality
 * Provides constants, helpers, and platform detection
 */

import { Platform } from "react-native"

/**
 * Platform detection utilities
 */
export const isWeb = Platform.OS === "web"
export const isNative = Platform.OS === "ios" || Platform.OS === "android"

/**
 * Seattle coordinates (default map center)
 */
export const SEATTLE_COORDINATES = {
  longitude: -122.3321,
  latitude: 47.6062,
}

/**
 * Default camera state (native format - canonical)
 * Matches MapStateContext for single source of truth
 */
export const DEFAULT_CAMERA_STATE = {
  centerCoordinate: [
    SEATTLE_COORDINATES.longitude,
    SEATTLE_COORDINATES.latitude,
  ],
  zoomLevel: 10, // Match MapStateContext
  heading: 0,
  pitch: 45,
} as const

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
} as const

/**
 * Default map style
 */
export const DEFAULT_MAP_STYLE = MAP_STYLES.STREETS
