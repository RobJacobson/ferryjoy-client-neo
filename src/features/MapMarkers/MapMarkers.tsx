/**
 * Generic MapMarkers component
 *
 * Renders markers on a map using provided data and render function.
 * Handles loading states, error states, and visibility based on zoom level.
 * This component is agnostic to the type of data being rendered as markers.
 *
 * @example
 * ```tsx
 * // Basic usage with vessel data
 * <MapMarkers
 *   data={vesselData}
 *   visible={isLoading}
 *   renderMarker={(vessel) => (
 *     <VesselMarker
 *       key={vessel.id}
 *       vessel={vessel}
 *       onPress={handleVesselPress}
 *     />
 *   )}
 * />
 *
 * ```
 */

/**
 * Base interface for marker data
 */
export interface MapMarkerData {
  id: string;
  longitude: number;
  latitude: number;
}

/**
 * Generic MapMarkers component
 *
 * This component provides a reusable way to render markers on a map.
 * It handles common concerns like loading states, error states, and zoom-based visibility.
 * The actual rendering of each marker is delegated to the provided renderMarker function.
 *
 * @template T - Type extending MapMarkerData
 * @param data - Array of marker data objects
 * @param visible - Visibility state flag
 * @param renderMarker - Function to render each marker
 * @returns React elements representing markers or null if markers should not be displayed
 */
export const MapMarkers = <T extends MapMarkerData>({
  data,
  visible = true,
  renderMarker,
}: {
  data: T[] | undefined;
  visible?: boolean;
  renderMarker: (item: T) => React.ReactNode;
}) => {
  // Handle visibility state
  if (!visible) {
    return null;
  }

  return <>{data?.map(item => renderMarker(item))}</>;
};
