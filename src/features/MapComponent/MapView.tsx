/**
 * Native MapView implementation
 * Simple wrapper around @rnmapbox/maps
 */

import MapboxRN from "@rnmapbox/maps"
import { nativeMapStateToCameraState } from "./cameraState"
import type { MapViewProps } from "./shared"
import { DEFAULT_CAMERA_STATE } from "./shared"

export const MapView = ({
  mapStyle,
  onMapReady,
  onCameraChanged,
  children,
}: MapViewProps) => {
  // Use ref callback to initialize map when ref is set
  const mapRefCallback = (mapInstance: MapboxRN.MapView | null) => {
    if (mapInstance) {
      onMapReady(mapInstance)
    }
  }

  return (
    <MapboxRN.MapView
      ref={mapRefCallback}
      className="flex-1"
      styleURL={mapStyle}
      onCameraChanged={state =>
        onCameraChanged(nativeMapStateToCameraState(state))
      }
      scaleBarEnabled={false}
    >
      <MapboxRN.Camera
        defaultSettings={{
          centerCoordinate: [...DEFAULT_CAMERA_STATE.centerCoordinate],
          zoomLevel: DEFAULT_CAMERA_STATE.zoomLevel,
          heading: DEFAULT_CAMERA_STATE.heading,
          pitch: DEFAULT_CAMERA_STATE.pitch,
        }}
      />
      {children}
    </MapboxRN.MapView>
  )
}
