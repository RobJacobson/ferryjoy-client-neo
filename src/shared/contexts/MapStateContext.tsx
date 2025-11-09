import type { PropsWithChildren } from "react"
import { createContext, useContext, useState } from "react"

import type { CameraState } from "@/features/MapComponent/cameraState"
import { DEFAULT_CAMERA_STATE } from "@/features/MapComponent/utils/mapbox"

/**
 * Map state information using the refactored map's CameraState format
 * Provides a unified interface for both native and web platforms
 */
type MapState = {
  // Camera state in native format (canonical)
  cameraState: CameraState
  // Map viewport dimensions
  mapDimensions: {
    width: number
    height: number
  }
}

/**
 * Context value providing current map state for read-only access
 */
type MapStateContextType = MapState & {
  updateMapState: (newState: Partial<MapState>) => void
  updateCameraState: (cameraState: CameraState) => void
  updateMapDimensions: (width: number, height: number) => void
  // Convenience getters for backward compatibility
  latitude: number
  longitude: number
  zoom: number
  pitch: number
  heading: number
}

/**
 * React context for sharing map state data across the app.
 * Provides read-only access to current map position, zoom, pitch, heading, and dimensions.
 * Uses the refactored map's CameraState format for consistency.
 */
const MapStateContext = createContext<MapStateContextType | undefined>(
  undefined
)

/**
 * Provider component that manages map state updates from refactored map components.
 * Initializes with default Seattle coordinates and standard map settings.
 */
export const MapStateProvider = ({ children }: PropsWithChildren) => {
  const [mapState, setMapState] = useState<MapState>({
    cameraState: DEFAULT_CAMERA_STATE,
    mapDimensions: {
      width: 800,
      height: 600,
    },
  })

  const updateMapState = (newState: Partial<MapState>) => {
    setMapState(prev => ({ ...prev, ...newState }))
  }

  const updateCameraState = (cameraState: CameraState) => {
    setMapState(prev => ({
      ...prev,
      cameraState,
    }))
  }

  const updateMapDimensions = (width: number, height: number) => {
    setMapState(prev => ({
      ...prev,
      mapDimensions: { width, height },
    }))
  }

  // Convenience getters for backward compatibility
  const { cameraState } = mapState
  const contextValue: MapStateContextType = {
    ...mapState,
    // Convenience getters
    latitude: cameraState.centerCoordinate[1],
    longitude: cameraState.centerCoordinate[0],
    zoom: cameraState.zoomLevel,
    pitch: cameraState.pitch,
    heading: cameraState.heading,
    // Update functions
    updateMapState,
    updateCameraState,
    updateMapDimensions,
  }

  return <MapStateContext value={contextValue}>{children}</MapStateContext>
}

/**
 * Hook to access current map state for read-only operations.
 * Provides map position, zoom, pitch, heading, and dimensions data.
 * Must be used within MapStateProvider.
 */
export const useMapState = () => {
  const context = useContext(MapStateContext)
  if (context === undefined) {
    throw new Error("useMapState must be used within MapStateProvider")
  }
  return context
}
