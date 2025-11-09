/**
 * Native implementation of Map component
 * Uses @rnmapbox/maps directly without abstraction layers
 */

import MapboxRN from "@rnmapbox/maps"
import { useCallback, useEffect, useRef } from "react"
import { View } from "react-native"

import { useMapState } from "@/shared/contexts"

import {
  type CameraState,
  createCameraStateHandler,
  nativeMapStateToCameraState,
} from "./cameraState"
import { DEFAULT_MAP_PROPS, type MapProps, styles } from "./shared"

/**
 * Map component for native platform
 * Uses @rnmapbox/maps MapView with 20fps state updates for smooth but performant animations
 */
export const MapComponent = ({
  mapStyle = DEFAULT_MAP_PROPS.mapStyle,
  children,
  onCameraStateChange,
}: MapProps) => {
  const { cameraState, updateCameraState, updateMapDimensions } = useMapState()
  const mapRef = useRef<MapboxRN.MapView>(null)

  // Memoize the camera state handler to prevent unnecessary re-renders
  const handleCameraStateChange = useCallback(
    (cameraState: CameraState) => {
      updateCameraState(cameraState)
      onCameraStateChange?.(cameraState)
    },
    [updateCameraState, onCameraStateChange]
  )

  // Simple debounced camera change handler - only update context after gestures end
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCameraChanged = useCallback(
    (state: MapboxRN.MapState) => {
      // Clear previous timeout to debounce rapid camera changes
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Debounce camera state updates to avoid interfering with smooth gestures
      timeoutRef.current = setTimeout(() => {
        const cameraState = nativeMapStateToCameraState(state)
        handleCameraStateChange(cameraState)
      }, 100) // Update state 100ms after camera movement stops
    },
    [handleCameraStateChange]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleLayout = (event: {
    nativeEvent: { layout: { width: number; height: number } }
  }) => {
    const { width, height } = event.nativeEvent.layout
    updateMapDimensions(width, height)
  }

  return (
    <View style={styles.container}>
      <MapboxRN.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={mapStyle}
        onCameraChanged={handleCameraChanged}
        onLayout={handleLayout}
        scaleBarEnabled={false}
      >
        <MapboxRN.Camera
          centerCoordinate={[...cameraState.centerCoordinate]}
          zoomLevel={cameraState.zoomLevel}
          heading={cameraState.heading}
          pitch={cameraState.pitch}
          animationDuration={500}
          animationMode="flyTo"
        />
        {children}
      </MapboxRN.MapView>
    </View>
  )
}
