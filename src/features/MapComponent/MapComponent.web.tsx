/**
 * Web implementation of Map component
 * Uses react-map-gl/mapbox directly without abstraction layers
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import MapboxGL, {
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/mapbox"

import { useMapState } from "@/shared/contexts"

import {
  type CameraState,
  createCameraStateHandler,
  toWebViewState,
  webViewStateToCameraState,
} from "./cameraState"
import { DEFAULT_MAP_PROPS, type MapProps, styles } from "./shared"

/**
 * Map component for web platform
 * Uses react-map-gl MapGL component with uncontrolled viewState for natural movement
 */
export const MapComponent = ({
  mapStyle = DEFAULT_MAP_PROPS.mapStyle,
  children,
  onCameraStateChange,
}: MapProps) => {
  const { cameraState, updateCameraState, updateMapDimensions } = useMapState()
  const [mapInstance, setMapInstance] = useState<MapRef | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Memoize the camera state handler to prevent infinite re-renders
  const handleCameraStateChange = useCallback(
    (cameraState: CameraState) => {
      updateCameraState(cameraState)
      onCameraStateChange?.(cameraState)
    },
    [updateCameraState, onCameraStateChange]
  )

  // Convert native camera state to web format for react-map-gl
  // Use as initialViewState to set starting position without blocking natural movement
  const initialWebViewState = useMemo(
    () => toWebViewState(cameraState),
    [cameraState]
  )

  // Set up ResizeObserver to track container size changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Initial measurement
    const updateDimensions = () => {
      const width = container.offsetWidth
      const height = container.offsetHeight
      updateMapDimensions(width, height)
    }

    // Measure immediately
    updateDimensions()

    // Set up ResizeObserver for future changes
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [updateMapDimensions])

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
      <MapboxGL
        ref={setMapInstance}
        initialViewState={initialWebViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        projection="mercator"
        onMove={(evt: ViewStateChangeEvent) =>
          handleCameraStateChange(webViewStateToCameraState(evt.viewState))
        }
        reuseMaps
        mapboxAccessToken={process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN}
      >
        {children}
      </MapboxGL>
    </div>
  )
}
