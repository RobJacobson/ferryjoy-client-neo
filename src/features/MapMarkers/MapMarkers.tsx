/**
 * Generic MapMarkers component
 *
 * Renders markers on a map using provided data and render function.
 * Handles loading states, error states, and visibility based on zoom level.
 * This component is agnostic to the type of data being rendered as markers.
 */

import { View } from "react-native";
import { useMapState } from "@/shared/contexts";

/**
 * Base interface for marker data
 */
export interface MapMarkerData {
  id: string;
  longitude: number;
  latitude: number;
}

/**
 * Props for the MapMarkers component
 * @template T - Type extending MapMarkerData
 */
export interface MapMarkersProps<T extends MapMarkerData> {
  /** Array of marker data objects */
  data: T[] | undefined;
  /** Loading state flag */
  isLoading?: boolean;
  /** Error state flag */
  isError?: boolean;
  /** Error object if isError is true */
  error?: unknown;
  /** Zoom level threshold for showing markers */
  zoomThreshold?: number;
  /** Function to render each marker */
  renderMarker: (item: T) => React.ReactNode;
  /** Optional callback for marker press events */
  onMarkerPress?: (item: T) => void;
}

/**
 * Generic MapMarkers component
 *
 * This component provides a reusable way to render markers on a map.
 * It handles common concerns like loading states, error states, and zoom-based visibility.
 * The actual rendering of each marker is delegated to the provided renderMarker function.
 *
 * @param props - Component props
 * @returns React elements representing markers or null if markers should not be displayed
 *
 * @example
 * ```tsx
 * // Basic usage with vessel data
 * <MapMarkers
 *   data={vesselData}
 *   isLoading={isLoading}
 *   isError={isError}
 *   zoomThreshold={8}
 *   renderMarker={(vessel) => (
 *     <VesselMarker
 *       key={vessel.id}
 *       vessel={vessel}
 *       onPress={handleVesselPress}
 *     />
 *   )}
 * />
 *
 * // Usage with port data
 * <MapMarkers
 *   data={portData}
 *   renderMarker={(port) => (
 *     <PortMarker
 *       key={port.id}
 *       port={port}
 *       onPress={handlePortPress}
 *     />
 *   )}
 * />
 * ```
 */
export const MapMarkers = <T extends MapMarkerData>({
  data,
  isLoading = false,
  isError = false,
  error,
  zoomThreshold = 0,
  renderMarker,
  onMarkerPress,
}: MapMarkersProps<T>) => {
  const { zoom } = useMapState();

  // Handle loading state
  if (isLoading) {
    return null;
  }

  // Handle error state
  if (isError) {
    console.error("Error loading marker data:", error);
    return null;
  }

  // Handle empty data
  if (!data || data.length === 0) {
    return null;
  }

  // Only show markers when zoomed in enough (if threshold is set)
  if (zoomThreshold > 0 && zoom < zoomThreshold) {
    return null;
  }

  return (
    <>
      {data.map(item => {
        // If onMarkerPress is provided, wrap the marker with press handling
        if (onMarkerPress) {
          return (
            <View key={item.id} onTouchEnd={() => onMarkerPress(item)}>
              {renderMarker(item)}
            </View>
          );
        }

        // Otherwise just render the marker as is
        return renderMarker(item);
      })}
    </>
  );
};
