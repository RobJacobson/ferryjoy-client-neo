/**
 * Web Map Controller API
 * Provides imperative control methods for web map implementations (react-map-gl)
 */

import type mapboxgl from "mapbox-gl"
import type { CameraState } from "./cameraState"
import type { MapController } from "./shared"

// Helper function to convert CameraState to web map options
const toWebMapOptions = (destination: CameraState, duration?: number) => ({
  center: [...destination.centerCoordinate] as [number, number],
  zoom: destination.zoomLevel,
  bearing: destination.heading,
  pitch: destination.pitch,
  duration,
})

export const createMapController = (
  mapInstance: mapboxgl.Map
): MapController | null => {
  if (!mapInstance) return null

  return {
    flyTo: (destination, duration) => {
      mapInstance.flyTo(toWebMapOptions(destination, duration))
    },
    easeTo: (destination, duration) => {
      mapInstance.easeTo(toWebMapOptions(destination, duration))
    },
    jumpTo: destination => {
      mapInstance.jumpTo(toWebMapOptions(destination))
    },
    getCenter: () => {
      const center = mapInstance.getCenter()
      return center ? [center.lng, center.lat] : undefined
    },
    getZoom: () => mapInstance.getZoom(),
  }
}
