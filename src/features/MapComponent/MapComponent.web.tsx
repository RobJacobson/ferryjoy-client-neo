/**
 * Web MapComponent implementation
 * Simple wrapper around react-map-gl
 */

import { useEffect, useRef } from "react";
import type { MapRef, ViewState } from "react-map-gl/mapbox";
import MapboxGL from "react-map-gl/mapbox";

import { useMapState } from "@/data/contexts";
import { MAP_COMPONENT_CONFIG } from "./config";
import type { CameraState, MapProps } from "./shared";
import {
  cameraStateToViewState,
  DEFAULT_NATIVE_CAMERA_STATE,
  handleCameraStateChange,
  webViewStateToCameraState,
} from "./shared";

export const MapComponent = ({ children, initialCameraState }: MapProps) => {
  // Only use the update function from context, not the state
  const { updateCameraState, updateMapDimensions } = useMapState();
  const mapRef = useRef<MapRef>(null);

  // Keep track of previous camera state to avoid unnecessary updates
  const previousCameraStateRef = useRef<CameraState>(
    initialCameraState || DEFAULT_NATIVE_CAMERA_STATE
  );

  // Convert CameraState to ViewState for map
  const viewState = {
    ...cameraStateToViewState(
      initialCameraState || DEFAULT_NATIVE_CAMERA_STATE
    ),
    width: 800,
    height: 600,
  };

  // Update map dimensions when component mounts
  useEffect(() => {
    updateMapDimensions({ width: 800, height: 600 });
  }, [updateMapDimensions]);

  // Handle camera changes and update context
  const handleMove = (evt: { viewState: ViewState }) => {
    const newCameraState = webViewStateToCameraState(evt.viewState);
    handleCameraStateChange(
      newCameraState,
      previousCameraStateRef,
      updateCameraState
    );
  };

  return (
    <div className="flex-1 relative">
      <MapboxGL
        ref={mapRef}
        viewState={viewState}
        style={{ flex: 1 }}
        mapStyle={MAP_COMPONENT_CONFIG.styleURL}
        projection="mercator"
        onMove={handleMove}
        reuseMaps
      >
        {children}
      </MapboxGL>
    </div>
  );
};
