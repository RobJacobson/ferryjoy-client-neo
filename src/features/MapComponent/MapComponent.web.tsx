/**
 * Web implementation of Map component
 * Uses react-map-gl/mapbox directly without abstraction layers
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import MapboxGL, {
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/mapbox"

import { useMapState } from "@/shared/contexts"
import { useSetMapController } from "@/shared/contexts/MapController"
import { webViewStateToCameraState } from "./cameraState"
import { createMapController, type MapController } from "./MapController"
import { DEFAULT_MAP_PROPS, type MapProps } from "./shared"
import { DEFAULT_CAMERA_STATE } from "./utils/mapbox"

export interface MapComponentRef {
  getController: () => MapController | null
}

/**
 * Map component for web platform
 * Uses react-map-gl MapGL component with uncontrolled viewState for natural movement
 */
export const MapComponent = forwardRef<MapComponentRef, MapProps>(
  (
    { mapStyle = DEFAULT_MAP_PROPS.mapStyle, children, onCameraStateChange },
    ref
  ) => {
    const { updateMapDimensions, _updateCameraState } = useMapState()
    const [mapInstance, setMapInstance] = useState<MapRef | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const controllerRef = useRef<MapController | null>(null)
    const setController = useSetMapController()

    // Initialize controller when map instance is available
    useEffect(() => {
      controllerRef.current = createMapController(mapInstance)
      setController(controllerRef.current)
    }, [mapInstance, setController])

    // Simple camera change handler - update context and notify callback
    const handleMove = (evt: ViewStateChangeEvent) => {
      const cameraState = webViewStateToCameraState(evt.viewState)
      _updateCameraState(cameraState)
      onCameraStateChange?.(cameraState)
    }

    // Set up ResizeObserver to track container size changes
    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const updateDimensions = () => {
        const width = container.offsetWidth
        const height = container.offsetHeight
        updateMapDimensions(width, height)
      }

      updateDimensions()
      const resizeObserver = new ResizeObserver(updateDimensions)
      resizeObserver.observe(container)

      return () => {
        resizeObserver.disconnect()
      }
    }, [updateMapDimensions])

    // Expose controller through ref
    useImperativeHandle(ref, () => ({
      getController: () => controllerRef.current,
    }))

    return (
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
          onMove={handleMove}
          reuseMaps
          mapboxAccessToken={process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN}
        >
          {children}
        </MapboxGL>
      </div>
    )
  }
)
