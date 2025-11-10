/**
 * Web MapComponent implementation
 * Simple wrapper around react-map-gl
 */

import { useRef } from "react";
import type { MapRef, ViewState } from "react-map-gl/mapbox";
import MapboxGL from "react-map-gl/mapbox";

import { useMapState } from "@/shared/contexts";
import type { MapProps } from "./shared";
import { cameraStateToViewState, webViewStateToCameraState } from "./shared";

export const MapComponent = ({ children }: MapProps) => {
  const { cameraState, mapStyle, updateCameraState } = useMapState();
  const mapRef = useRef<MapRef>(null);
  const previousCameraStateRef = useRef(cameraState);

  // Convert CameraState to ViewState for map
  const viewState = {
    ...cameraStateToViewState(cameraState),
    width: 800,
    height: 600,
  };

  // Handle camera changes and update context
  const handleMove = (evt: { viewState: ViewState }) => {
    const newCameraState = webViewStateToCameraState(evt.viewState);

    // Only update if the camera state has actually changed
    if (
      newCameraState.centerCoordinate[0] !==
        previousCameraStateRef.current.centerCoordinate[0] ||
      newCameraState.centerCoordinate[1] !==
        previousCameraStateRef.current.centerCoordinate[1] ||
      newCameraState.zoomLevel !== previousCameraStateRef.current.zoomLevel ||
      newCameraState.heading !== previousCameraStateRef.current.heading ||
      newCameraState.pitch !== previousCameraStateRef.current.pitch
    ) {
      updateCameraState(newCameraState);
      previousCameraStateRef.current = newCameraState;
    }
  };

  return (
    <div className="flex-1 relative">
      <MapboxGL
        ref={mapRef}
        viewState={viewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        projection="mercator"
        onMove={handleMove}
        reuseMaps
      >
        {children}
      </MapboxGL>
    </div>
  );
};
