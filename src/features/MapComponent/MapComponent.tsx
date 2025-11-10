/**
 * Map component for both native and web platforms
 *
 * This component provides a unified map interface that works on both native (iOS/Android)
 * and web platforms. It uses platform-specific MapView implementations internally while
 * exposing a consistent API to consumers.
 *
 * The component follows an uncontrolled pattern where the map manages its own state
 * internally, but provides imperative control through the MapController API.
 *
 * @file Unified map component for cross-platform usage
 */

import { forwardRef, useImperativeHandle, useRef } from "react"
import { View } from "react-native"
import type { MapProps } from "@/features/MapComponent/shared"
import { DEFAULT_MAP_PROPS } from "@/features/MapComponent/shared"
import { useMapState } from "@/shared/contexts"
import { useSetMapController } from "@/shared/contexts/MapController"
import type { CameraState } from "./cameraState"
import { createMapController, type MapController } from "./MapController"
import { MapView } from "./MapView" // Platform-specific import

/**
 * Interface for MapComponent ref
 *
 * This interface defines methods that can be accessed through the component's ref.
 * It provides access to the underlying map controller for imperative operations.
 */
export interface MapComponentRef {
  /**
   * Gets the map controller instance
   *
   * @returns The map controller instance or null if not initialized
   *
   * @example
   * ```tsx
   * const mapRef = useRef<MapComponentRef>(null);
   *
   * const handleFlyToSeattle = () => {
   *   const controller = mapRef.current?.getController();
   *   if (controller) {
   *     controller.flyTo({
   *       centerCoordinate: [-122.3321, 47.6062],
   *       zoomLevel: 12,
   *       heading: 0,
   *       pitch: 45
   *     }, 2000);
   *   }
   * };
   *
   * <MapComponent ref={mapRef} />
   * ```
   */
  getController: () => MapController | null
}

/**
 * Map component for both native and web platforms
 *
 * This is the main map component that provides a unified interface for rendering maps
 * on both native and web platforms. It handles platform-specific implementations internally
 * while exposing a consistent API.
 *
 * The component manages map initialization, camera state changes, and layout updates.
 * It also integrates with the MapController context to provide imperative control.
 *
 * @param props - The component props
 * @param props.mapStyle - The map style URL
 * @param props.children - Child components to render on the map
 * @param props.onCameraStateChange - Callback when the map camera state changes
 * @param ref - The component ref
 *
 * @returns The rendered map component
 *
 * @example
 * ```typescript
 * import { MapComponent } from '@/features/MapComponent';
 *
 * // Create a map component with custom style
 * const mapStyle = "mapbox://styles/mapbox/streets-v12";
 * const handleCameraChange = (cameraState) => {
 *   console.log('Camera changed:', cameraState);
 * };
 *
 * // Use the MapComponent in your app
 * // <MapComponent mapStyle={mapStyle} onCameraStateChange={handleCameraChange} />
 * ```
 */
export const MapComponent = forwardRef<MapComponentRef, MapProps>(
  (
    { mapStyle = DEFAULT_MAP_PROPS.mapStyle, children, onCameraStateChange },
    ref
  ) => {
    const { updateMapDimensions, _updateCameraState } = useMapState()
    const mapRef = useRef<unknown>(null)
    const controllerRef = useRef<MapController | null>(null)
    const setController = useSetMapController()

    /**
     * Initialize controller when map ref is available
     *
     * This function is called when the map is ready. It creates a controller
     * instance and stores it in both the local ref and the global context.
     *
     * @param mapInstance - The platform-specific map instance
     */
    const handleMapReady = (mapInstance: unknown) => {
      mapRef.current = mapInstance
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
      _updateCameraState(cameraState)
      onCameraStateChange?.(cameraState)
    }

    /**
     * Handle layout changes
     *
     * This function is called when the map's layout changes. It updates
     * the global map dimensions.
     *
     * @param width - The new width of the map
     * @param height - The new height of the map
     */
    const handleLayout = (width: number, height: number) => {
      updateMapDimensions(width, height)
    }

    // Expose controller through ref
    useImperativeHandle(ref, () => ({
      getController: () => controllerRef.current,
    }))

    return (
      <View className="flex-1 relative">
        <MapView
          mapStyle={mapStyle}
          onMapReady={handleMapReady}
          onCameraChanged={handleCameraChanged}
          onLayout={handleLayout}
        >
          {children}
        </MapView>
      </View>
    )
  }
)
