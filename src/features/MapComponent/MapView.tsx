/**
 * Native MapView implementation
 * Simple wrapper around @rnmapbox/maps
 */

import MapboxRN from "@rnmapbox/maps"
import { useEffect, useRef } from "react"
import { nativeMapStateToCameraState } from "./cameraState"
import type { MapViewProps } from "./shared"

export const MapView = ({
  mapStyle,
  onMapReady,
  onCameraChanged,
  onLayout,
  children,
}: MapViewProps) => {
  const mapRef = useRef<MapboxRN.MapView>(null)

  // Initialize map when ready
  useEffect(() => {
    if (mapRef.current) {
      onMapReady(mapRef.current)
    }
  }, [onMapReady])

  return (
    <MapboxRN.MapView
      ref={mapRef}
      className="flex-1"
      styleURL={mapStyle}
      onCameraChanged={state =>
        onCameraChanged(nativeMapStateToCameraState(state))
      }
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout
        onLayout(width, height)
      }}
      scaleBarEnabled={false}
    >
      {children}
    </MapboxRN.MapView>
  )
}
