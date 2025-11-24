import { usePerspectiveScale } from "./usePerspectiveScale";
import { useZoomScale } from "./useZoomScale";

/**
 * Hook to calculate the combined scale factor for a marker
 * Combines zoom-based scaling with perspective scaling based on map pitch and position
 *
 * @param latitude - The latitude coordinate of the marker
 * @param longitude - The longitude coordinate of the marker
 * @returns The combined scale factor for the marker
 */
export const useMapScale = (latitude: number, longitude: number): number => {
  const zoomScale = useZoomScale();
  const perspectiveScale = usePerspectiveScale(latitude, longitude);

  // Calculate final marker size by combining both scaling factors
  return zoomScale * perspectiveScale;
};
