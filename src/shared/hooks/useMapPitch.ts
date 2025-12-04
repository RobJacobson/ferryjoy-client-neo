import { useMapState } from "../../data/contexts/MapStateContext";

/**
 * Hook to get the current pitch angle of the map
 * Pitch represents the tilt angle in degrees (0-90, where 0 is directly overhead)
 *
 * @returns The current pitch angle in degrees
 */
export const useMapPitch = (): number => {
  const { cameraState } = useMapState();
  return cameraState.pitch;
};
