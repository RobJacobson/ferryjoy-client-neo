// /**
//  * Map component for both native and web platforms
//  *
//  * This component provides a unified map interface that works on both native (iOS/Android)
//  * and web platforms. It uses platform-specific MapView implementations internally while
//  * exposing a consistent API to consumers.
//  *
//  * The component follows an uncontrolled pattern where the map manages its own state
//  * internally, but provides imperative control through the MapController API.
//  *
//  * @file Unified map component for cross-platform usage
//  */

import { useRef } from "react"
import { View } from "react-native"
import type { MapProps } from "@/features/MapComponent/shared"
import { DEFAULT_MAP_PROPS } from "@/features/MapComponent/shared"
import { useMapState } from "@/shared/contexts"
import { useSetMapController } from "@/shared/contexts/MapController"
import type { CameraState } from "./cameraState"
import { createMapController, type MapController } from "./MapController"
import { MapView } from "./MapView" // Platform-specific import

/**
 * Map component for both native and web platforms
 *
 * This is the main map component that provides a unified interface for rendering maps
 * on both native and web platforms. It handles platform-specific implementations internally
 * while exposing a consistent API.
 *
 * The component manages map initialization and camera state changes.
 * It integrates with the MapController context to provide imperative control via useMapController().
 *
 * @param props - The component props
 * @param props.mapStyle - The map style URL
 * @param props.children - Child components to render on the map
 * @param props.onCameraStateChange - Callback when the map camera state changes
 *
 * @returns The rendered map component
 *
 * @example
 * ```typescript
 * import { MapComponent } from '@/features/MapComponent';
 * import { useMapController } from '@/shared/contexts';
 *
 * // Use the MapComponent in your app
 * <MapComponent mapStyle={mapStyle} onCameraStateChange={handleCameraChange} />
 *
 * // Access controller via context hook
 * const controller = useMapController();
 * controller?.flyTo({ centerCoordinate: [-122.3321, 47.6062], zoomLevel: 12 });
 * ```
 */
export const MapComponent = ({
  mapStyle = DEFAULT_MAP_PROPS.mapStyle,
  children,
  onCameraStateChange,
}: MapProps) => {
  const { updateCameraState } = useMapState()
  const controllerRef = useRef<MapController | null>(null)
  const setController = useSetMapController()

  /**
   * Initialize controller when map ref is available
   *
   * This function is called when the map is ready. It creates a controller
   * instance and stores it in the global context.
   *
   * @param mapInstance - The platform-specific map instance
   */
  const handleMapReady = (mapInstance: unknown) => {
    controllerRef.current = createMapController(mapInstance)
    setController(controllerRef.current)
  }

  /**
   * Handle camera state changes
   *
   * This function is called when the map's camera state changes. It updates
   * the global map state and calls the optional user-provided callback.
   *
   * @param cameraState - The new camera state
   */
  const handleCameraChanged = (cameraState: CameraState) => {
    updateCameraState(cameraState)
    onCameraStateChange?.(cameraState)
  }

  return (
    <View className="flex-1 relative">
      <MapView
        mapStyle={mapStyle}
        onMapReady={handleMapReady}
        onCameraChanged={handleCameraChanged}
      >
        {children}
      </MapView>
    </View>
  )
}
