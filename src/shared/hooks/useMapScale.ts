import { useMapState } from "../../data/contexts/MapStateContext";

/**
 * Generic interface for objects with latitude and longitude properties
 */
export interface LatLon {
  latitude: number;
  longitude: number;
}

/**
 * Hook to calculate zoom-based scale factor for any object with latitude and longitude
 * Useful for scaling effects based on zoom level
 *
 * @returns Current zoom scale (zoom/10)
 */
export const useMapScale = (): number => {
  const { cameraState } = useMapState();
  return (cameraState?.zoomLevel || 10) / 10;
};
