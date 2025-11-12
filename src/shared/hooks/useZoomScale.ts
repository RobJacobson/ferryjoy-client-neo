import { useMapState } from "../contexts/MapStateContext";

/**
 * Hook to determine map's zoom level and return zoom/10
 * Useful for scaling effects based on zoom level
 *
 * @returns Current zoom scale (zoom/10)
 */
export const useZoomScale = (): number => {
  const { cameraState } = useMapState();
  return (cameraState?.zoomLevel || 10) / 10;
};
