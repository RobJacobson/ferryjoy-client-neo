/**
 * Unified Map Controller API
 * Provides imperative control methods for both native and web map implementations
 */

import type MapboxRN from "@rnmapbox/maps"
import type { MapRef } from "react-map-gl/mapbox"
import { isWeb } from "@/features/MapComponent/shared"
import type { CameraState } from "./cameraState"

// Define a type for the native MapView with the methods we need
type NativeMapViewWithMethods = MapboxRN.MapView & {
  flyTo: (center: [number, number], duration?: number) => void
  easeTo: (center: [number, number], duration?: number) => void
  setCamera: (options: {
    centerCoordinate: [number, number]
    zoomLevel: number
    heading: number
    pitch: number
  }) => void
}

export interface MapController {
  flyTo: (destination: CameraState, duration?: number) => void
  easeTo: (destination: CameraState, duration?: number) => void
  jumpTo: (destination: CameraState) => void
  getCenter: () => [number, number] | undefined
  getZoom: () => number | undefined
}

export const createMapController = (
  mapRef: MapRef | MapboxRN.MapView | null
): MapController | null => {
  if (!mapRef) return null

  if (isWeb) {
    const webMapRef = mapRef as MapRef
    return {
      flyTo: (destination, duration = 1000) => {
        webMapRef.flyTo({
          center: [...destination.centerCoordinate] as [number, number],
          zoom: destination.zoomLevel,
          bearing: destination.heading,
          pitch: destination.pitch,
          duration,
        })
      },
      easeTo: (destination, duration = 500) => {
        webMapRef.easeTo({
          center: [...destination.centerCoordinate] as [number, number],
          zoom: destination.zoomLevel,
          bearing: destination.heading,
          pitch: destination.pitch,
          duration,
        })
      },
      jumpTo: destination => {
        webMapRef.jumpTo({
          center: [...destination.centerCoordinate] as [number, number],
          zoom: destination.zoomLevel,
          bearing: destination.heading,
          pitch: destination.pitch,
        })
      },
      getCenter: () => {
        const center = webMapRef.getCenter()
        return center ? [center.lng, center.lat] : undefined
      },
      getZoom: () => webMapRef.getZoom(),
    }
  } else {
    const nativeMapRef = mapRef as NativeMapViewWithMethods
    return {
      flyTo: (destination, duration = 1000) => {
        nativeMapRef.flyTo(
          [...destination.centerCoordinate] as [number, number],
          duration
        )
      },
      easeTo: (destination, duration = 500) => {
        nativeMapRef.easeTo(
          [...destination.centerCoordinate] as [number, number],
          duration
        )
      },
      jumpTo: destination => {
        nativeMapRef.setCamera({
          centerCoordinate: [...destination.centerCoordinate] as [
            number,
            number,
          ],
          zoomLevel: destination.zoomLevel,
          heading: destination.heading,
          pitch: destination.pitch,
        })
      },
      getCenter: () => {
        // @rnmapbox/maps doesn't provide a direct getCenter method
        // This would need to be tracked through state updates
        return undefined
      },
      getZoom: () => {
        // @rnmapbox/maps doesn't provide a direct getZoom method
        // This would need to be tracked through state updates
        return undefined
      },
    }
  }
}
