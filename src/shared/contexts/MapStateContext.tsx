import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo, useState } from "react";

import type { ViewState } from "react-map-gl/mapbox";
import type { CameraState } from "@/features/MapComponent/shared";
import {
  DEFAULT_MAP_STYLE,
  DEFAULT_NATIVE_CAMERA_STATE,
} from "@/features/MapComponent/shared";
import type { MapDimensions } from "@/shared/utils/mapProjection";

/**
 * Type definition for the MapState context value
 *
 * Provides access to the current map state and methods to update it.
 * This context is used to share map state across the application.
 */
type MapStateContextType = {
  /** Current camera state including position, zoom, pitch, and heading */
  cameraState: CameraState;
  /** Current map style URL */
  mapStyle: string;
  /** Current map dimensions in pixels */
  mapDimensions: MapDimensions;
  /** Method for updating camera state (used by MapComponents) */
  updateCameraState: (cameraState: CameraState) => void;
  /** Method for updating map style */
  updateMapStyle: (mapStyle: string) => void;
  /** Method for updating map dimensions */
  updateMapDimensions: (dimensions: MapDimensions) => void;
  /** Convenience getter for zoom level (for components like MapVesselMarkers) */
  zoom: number;
};

/**
 * React context for sharing map state data across the app.
 *
 * This context provides access to current map position, zoom, pitch, heading, and style.
 * It uses the CameraState format as the single source of truth for map state.
 * Components can consume this context using the useMapState hook.
 */
const MapStateContext = createContext<MapStateContextType | undefined>(
  undefined
);

/**
 * Provider component that manages map state updates from map components.
 *
 * This component initializes the map with default Seattle coordinates, standard map settings,
 * and default map style. It provides state management for camera position and map style.
 *
 * @example
 * ```tsx
 * <MapStateProvider>
 *   <App />
 * </MapStateProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the map state
 * @returns A context provider component
 */
export const MapStateProvider = ({ children }: PropsWithChildren) => {
  const [cameraState, setCameraState] = useState<CameraState>(
    DEFAULT_NATIVE_CAMERA_STATE
  );
  const [mapStyle, setMapStyle] = useState<string>(DEFAULT_MAP_STYLE);
  const [mapDimensions, setMapDimensions] = useState<MapDimensions>({
    width: 0,
    height: 0,
  });

  /**
   * Updates the camera state with new values
   *
   * @param newCameraState - The new camera state to set
   */
  const updateCameraState = (newCameraState: CameraState) => {
    setCameraState(newCameraState);
  };

  /**
   * Updates the map style with a new style URL
   *
   * @param newMapStyle - The new map style URL to set
   */
  const updateMapStyle = (newMapStyle: string) => {
    setMapStyle(newMapStyle);
  };

  /**
   * Updates the map dimensions
   *
   * @param dimensions - The new map dimensions to set
   */
  const updateMapDimensions = (dimensions: MapDimensions) => {
    setMapDimensions(dimensions);
  };

  /**
   * Memoized context value containing all map state and update functions
   */
  const contextValue: MapStateContextType = {
    cameraState,
    mapStyle,
    mapDimensions,
    // Update functions
    updateCameraState,
    updateMapStyle,
    updateMapDimensions,
    // Convenience getter for zoom level
    zoom: cameraState.zoomLevel,
  };

  return <MapStateContext value={contextValue}>{children}</MapStateContext>;
};

/**
 * Hook to access current map state.
 *
 * Provides map position, zoom, pitch, heading data, map style, and update methods.
 * Must be used within a MapStateProvider component.
 *
 * @example
 * ```tsx
 * const { cameraState, updateCameraState, mapStyle, updateMapStyle } = useMapState();
 * ```
 *
 * @returns The current map state context value
 * @throws Error if used outside of MapStateProvider
 */
export const useMapState = () => {
  const context = useContext(MapStateContext);
  if (context === undefined) {
    throw new Error("useMapState must be used within MapStateProvider");
  }
  return context;
};
