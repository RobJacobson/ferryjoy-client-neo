/**
 * Native implementation of Map component
 * Uses @rnmapbox/maps directly without abstraction layers
 */

import MapboxRN from "@rnmapbox/maps"
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { View } from "react-native"

import { useMapState } from "@/shared/contexts"
import { useSetMapController } from "@/shared/contexts/MapController"
import { type CameraState, nativeMapStateToCameraState } from "./cameraState"
import { createMapController, type MapController } from "./MapController"
import { DEFAULT_MAP_PROPS, type MapProps } from "./shared"
import { DEFAULT_CAMERA_STATE } from "./utils/mapbox"

export interface MapComponentRef {
  getController: () => MapController | null
}

/**
 * Map component for native platform
 * Uses @rnmapbox/maps MapView with uncontrolled camera for natural user interactions
 */
export const MapComponent = forwardRef<MapComponentRef, MapProps>(
  (
    { mapStyle = DEFAULT_MAP_PROPS.mapStyle, children, onCameraStateChange },
    ref
  ) => {
    const { updateMapDimensions, _updateCameraState } = useMapState()
    const mapRef = useRef<MapboxRN.MapView>(null)
    const controllerRef = useRef<MapController | null>(null)
    const setController = useSetMapController()

    // Initialize controller when map ref is available
    useEffect(() => {
      controllerRef.current = createMapController(mapRef.current)
      setController(controllerRef.current)
    }, [setController])

    // Simple camera change handler - update context and notify callback
    const handleCameraChanged = (state: MapboxRN.MapState) => {
      const cameraState = nativeMapStateToCameraState(state)
      _updateCameraState(cameraState)
      onCameraStateChange?.(cameraState)
    }

    const handleLayout = (event: {
      nativeEvent: { layout: { width: number; height: number } }
    }) => {
      const { width, height } = event.nativeEvent.layout
      updateMapDimensions(width, height)
    }

    // Expose controller through ref
    useImperativeHandle(ref, () => ({
      getController: () => controllerRef.current,
    }))

    return (
      <View className="flex-1 relative">
        <MapboxRN.MapView
          ref={mapRef}
          className="flex-1"
          styleURL={mapStyle}
          onCameraChanged={handleCameraChanged}
          onLayout={handleLayout}
          scaleBarEnabled={false}
        >
          <MapboxRN.Camera
            centerCoordinate={
              [...DEFAULT_CAMERA_STATE.centerCoordinate] as [number, number]
            }
            zoomLevel={DEFAULT_CAMERA_STATE.zoomLevel}
            heading={DEFAULT_CAMERA_STATE.heading}
            pitch={DEFAULT_CAMERA_STATE.pitch}
            animationDuration={500}
            animationMode="flyTo"
          />
          {children}
        </MapboxRN.MapView>
      </View>
    )
  }
)
