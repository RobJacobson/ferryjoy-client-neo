/**
 * Shared constants and utilities used across the application
 */

import type { PropsWithChildren } from "react"
import { Platform } from "react-native"
import type { CameraState } from "@/features/MapComponent/cameraState"

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
  zoomLevel: 12, // Better zoom level to show Seattle city properly
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

/**
 * Map component props type
 */
export type MapProps = PropsWithChildren<{
  /** Map style URL */
  mapStyle?: string
  /** Callback when map camera state changes */
  onCameraStateChange?: (cameraState: CameraState) => void
}>

/**
 * Default props for Map component
 */
export const DEFAULT_MAP_PROPS: MapProps = {
  mapStyle: DEFAULT_MAP_STYLE,
}

/**
 * Merge camera state with defaults
 */
export const mergeCameraState = (
  userCameraState?: Partial<CameraState>
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...userCameraState,
})

export interface MapViewProps {
  mapStyle?: string
  onMapReady: (mapInstance: unknown) => void
  onCameraChanged: (cameraState: CameraState) => void
  children: React.ReactNode
}

export interface MapController {
  flyTo: (destination: CameraState, duration?: number) => void
  easeTo: (destination: CameraState, duration?: number) => void
  jumpTo: (destination: CameraState) => void
  getCenter: () => [number, number] | undefined
  getZoom: () => number | undefined
}
