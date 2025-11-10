/**
 * Unified Map Controller API
 * Provides imperative control methods for both native and web map implementations
 */

import { Platform } from "react-native"
import type { CameraState } from "./cameraState"

// Type definitions for map instances
interface WebMapInstance {
  flyTo: (options: unknown) => void
  easeTo: (options: unknown) => void
  jumpTo: (options: unknown) => void
  getCenter: () => { lng: number; lat: number } | undefined
  getZoom: () => number | undefined
}

interface NativeMapInstance {
  flyTo: (center: [number, number], duration?: number) => void
  easeTo: (center: [number, number], duration?: number) => void
  setCamera: (options: unknown) => void
}

export interface MapController {
  flyTo: (destination: CameraState, duration?: number) => void
  easeTo: (destination: CameraState, duration?: number) => void
  jumpTo: (destination: CameraState) => void
  getCenter: () => [number, number] | undefined
  getZoom: () => number | undefined
}

// Helper function to convert CameraState to web map options
const toWebMapOptions = (destination: CameraState, duration?: number) => ({
  center: destination.centerCoordinate,
  zoom: destination.zoomLevel,
  bearing: destination.heading,
  pitch: destination.pitch,
  duration,
})

// Helper function to convert CameraState to native map options
const toNativeMapOptions = (destination: CameraState) => ({
  centerCoordinate: destination.centerCoordinate,
  zoomLevel: destination.zoomLevel,
  heading: destination.heading,
  pitch: destination.pitch,
})

export const createMapController = (
  mapInstance: unknown
): MapController | null => {
  if (!mapInstance) return null

  const isWeb = Platform.OS === "web"

  if (isWeb) {
    // Web implementation
    const instance = mapInstance as WebMapInstance

    return {
      flyTo: (destination, duration) => {
        instance.flyTo(toWebMapOptions(destination, duration))
      },
      easeTo: (destination, duration) => {
        instance.easeTo(toWebMapOptions(destination, duration))
      },
      jumpTo: destination => {
        instance.jumpTo(toWebMapOptions(destination))
      },
      getCenter: () => {
        const center = instance.getCenter()
        return center ? [center.lng, center.lat] : undefined
      },
      getZoom: () => instance.getZoom(),
    }
  } else {
    // Native implementation
    const instance = mapInstance as NativeMapInstance

    return {
      flyTo: (destination, duration) => {
        instance.flyTo([...destination.centerCoordinate], duration)
      },
      easeTo: (destination, duration) => {
        instance.easeTo([...destination.centerCoordinate], duration)
      },
      jumpTo: destination => {
        instance.setCamera(toNativeMapOptions(destination))
      },
      getCenter: () => undefined, // Native limitation
      getZoom: () => undefined, // Native limitation
    }
  }
}
