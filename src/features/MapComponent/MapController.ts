/**
 * Native Map Controller API
 * Provides imperative control methods for native map implementations (iOS/Android)
 */

import type { CameraState } from "./cameraState"
import type { MapController } from "./shared"

// Type definition for native map instance
// Note: MapView methods may not be fully typed, so we use a minimal interface
interface NativeMapInstance {
  flyTo: (center: [number, number], duration?: number) => void
  easeTo: (center: [number, number], duration?: number) => void
  setCamera: (options: {
    centerCoordinate: [number, number]
    zoomLevel: number
    heading: number
    pitch: number
  }) => void
}

// Helper function to convert CameraState to native map options
const toNativeMapOptions = (destination: CameraState) => ({
  centerCoordinate: [...destination.centerCoordinate] as [number, number],
  zoomLevel: destination.zoomLevel,
  heading: destination.heading,
  pitch: destination.pitch,
})

export const createMapController = (
  mapInstance: NativeMapInstance
): MapController | null => {
  if (!mapInstance) return null

  return {
    flyTo: (destination, duration) => {
      mapInstance.flyTo([...destination.centerCoordinate], duration)
    },
    easeTo: (destination, duration) => {
      mapInstance.easeTo([...destination.centerCoordinate], duration)
    },
    jumpTo: destination => {
      mapInstance.setCamera(toNativeMapOptions(destination))
    },
    getCenter: () => undefined, // Native limitation
    getZoom: () => undefined, // Native limitation
  }
}
