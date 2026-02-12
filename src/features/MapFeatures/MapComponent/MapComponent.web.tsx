/**
 * Web MapComponent implementation
 * Simple wrapper around react-map-gl
 */

import { useEffect, useRef, useState } from "react";
import type { MapRef, ViewState } from "react-map-gl/mapbox";
import MapboxGL from "react-map-gl/mapbox";

import { useMapCameraController, useMapState } from "@/data/contexts";
import { MAP_COMPONENT_CONFIG } from "./config";
import type { CameraState, MapProps } from "./shared";
import {
  cameraStateToViewState,
  DEFAULT_NATIVE_CAMERA_STATE,
  handleCameraStateChange,
  webViewStateToCameraState,
} from "./shared";
import { useRegisterMapCameraController } from "./useRegisterMapCameraController";

export const MapComponent = ({ children, initialCameraState }: MapProps) => {
  // Only use the update function from context, not the state
  const { updateCameraState, updateMapDimensions } = useMapState();
  const { registerController } = useMapCameraController();
  const mapRef = useRef<MapRef>(null);
  // Mapbox GL requires style to be loaded before adding sources/layers
  const [styleLoaded, setStyleLoaded] = useState(false);

  // Keep track of previous camera state to avoid unnecessary updates
  const previousCameraStateRef = useRef<CameraState>(
    initialCameraState || DEFAULT_NATIVE_CAMERA_STATE
  );

  // Use initialViewState only (uncontrolled). Passing viewState from context
  // would create a loop: onMove → updateCameraState → re-render → new viewState → onMove.
  const initialViewState = {
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

  // Register imperative camera controller for screens to call flyTo
  const flyToImpl = (target: CameraState, durationMs: number) => {
    mapRef.current?.flyTo({
      center: [...target.centerCoordinate] as [number, number],
      zoom: target.zoomLevel,
      bearing: target.heading,
      pitch: target.pitch,
      duration: durationMs,
    });
  };

  useRegisterMapCameraController({
    registerController,
    updateCameraState,
    flyToImpl,
    defaultDurationMs: 800,
  });

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
    <div className="relative flex-1">
      <MapboxGL
        ref={mapRef}
        initialViewState={initialViewState}
        style={{ flex: 1 }}
        mapStyle={MAP_COMPONENT_CONFIG.styleURL}
        projection="mercator"
        onMove={handleMove}
        onLoad={() => setStyleLoaded(true)}
        reuseMaps
      >
        {styleLoaded ? children : null}
      </MapboxGL>
    </div>
  );
};
