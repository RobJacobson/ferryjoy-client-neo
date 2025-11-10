/**
 * Web MapView implementation
 * Simple wrapper around react-map-gl
 */

import { useRef } from "react"
import type { MapRef } from "react-map-gl/mapbox"
import MapboxGL, { MapProvider } from "react-map-gl/mapbox"
import { webViewStateToCameraState } from "./cameraState"
import type { MapViewProps } from "./shared"
import { DEFAULT_CAMERA_STATE } from "./shared"

export const MapView = ({
  mapStyle,
  onMapReady,
  onCameraChanged,
  children,
}: MapViewProps) => {
  const mapRef = useRef<MapRef>(null)

  // Use onLoad callback to initialize map when ready
  const handleMapLoad = () => {
    if (mapRef.current) {
      // Get the underlying map instance using getMap()
      const mapInstance = mapRef.current.getMap()
      onMapReady(mapInstance)
    }
  }

  return (
    <MapProvider>
      <div className="flex-1 relative">
        <MapboxGL
          ref={mapRef}
          initialViewState={{
            longitude: DEFAULT_CAMERA_STATE.centerCoordinate[0],
            latitude: DEFAULT_CAMERA_STATE.centerCoordinate[1],
            zoom: DEFAULT_CAMERA_STATE.zoomLevel,
            pitch: DEFAULT_CAMERA_STATE.pitch,
            bearing: DEFAULT_CAMERA_STATE.heading,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
          projection="mercator"
          onLoad={handleMapLoad}
          onMove={evt =>
            onCameraChanged(webViewStateToCameraState(evt.viewState))
          }
          reuseMaps
        >
          {children}
        </MapboxGL>
      </div>
    </MapProvider>
  )
}
