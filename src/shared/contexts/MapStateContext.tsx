import type { PropsWithChildren } from "react"
import { createContext, useContext, useState } from "react"

import type { CameraState } from "@/features/MapComponent/cameraState"
import { DEFAULT_CAMERA_STATE } from "@/features/MapComponent/shared"

/**
 * Context value providing current map state
 */
type MapStateContextType = {
  // Current camera state
  cameraState: CameraState
  // Method for updating camera state (used by MapComponents)
  updateCameraState: (cameraState: CameraState) => void
  // Convenience getters for backward compatibility
  latitude: number
  longitude: number
  zoom: number
  pitch: number
  heading: number
}

/**
 * React context for sharing map state data across the app.
 * Provides access to current map position, zoom, pitch, and heading.
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
  const [cameraState, setCameraState] =
    useState<CameraState>(DEFAULT_CAMERA_STATE)

  // Method for updating camera state (used by MapComponents)
  const updateCameraState = (newCameraState: CameraState) => {
    setCameraState(newCameraState)
  }

  const contextValue: MapStateContextType = {
    cameraState,
    // Convenience getters
    latitude: cameraState.centerCoordinate[1],
    longitude: cameraState.centerCoordinate[0],
    zoom: cameraState.zoomLevel,
    pitch: cameraState.pitch,
    heading: cameraState.heading,
    // Update functions
    updateCameraState,
  }

  return <MapStateContext value={contextValue}>{children}</MapStateContext>
}

/**
 * Hook to access current map state.
 * Provides map position, zoom, pitch, heading data, and update methods.
 * Must be used within MapStateProvider.
 */
export const useMapState = () => {
  const context = useContext(MapStateContext)
  if (context === undefined) {
    throw new Error("useMapState must be used within MapStateProvider")
  }
  return context
}
