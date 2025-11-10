/**
 * Web MapView implementation
 * Simple wrapper around react-map-gl
 */

import { useEffect, useRef, useState } from "react"
import MapboxGL, { MapProvider } from "react-map-gl/mapbox"
import { webViewStateToCameraState } from "./cameraState"
import type { MapViewProps } from "./shared"
import { DEFAULT_CAMERA_STATE } from "./shared"

export const MapView = ({
  mapStyle,
  onMapReady,
  onCameraChanged,
  onLayout,
  children,
}: MapViewProps) => {
  const [mapInstance, setMapInstance] = useState<unknown>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize map when ready
  useEffect(() => {
    if (mapInstance) {
      onMapReady(mapInstance)
    }
  }, [mapInstance, onMapReady])

  // Handle dimension changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const width = container.offsetWidth
      const height = container.offsetHeight
      onLayout(width, height)
    }

    updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [onLayout])

  return (
    <MapProvider>
      <div ref={containerRef} className="flex-1 relative">
        <MapboxGL
          ref={setMapInstance}
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
