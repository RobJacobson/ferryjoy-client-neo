/**
 * MapVesselMarker component
 *
 * Renders an individual vessel marker on the map with proper styling.
 * This component is responsible for positioning marker and delegating
 * visual rendering to VesselMarkerContent.
 */

import type { VesselLocation } from "@/domain";
import { useMarkerScale, useMapPitch } from "@/shared/hooks";
import { Marker } from "../MapMarkers";
import { VesselMarkerContent } from "./VesselMarkerContent";
import { View } from "react-native";

/**
 * MapVesselMarker component
 *
 * Renders a single vessel marker with appropriate positioning and scaling.
 * The marker uses perspective scaling and tilting based on map pitch and
 * position in viewport. Visual representation is delegated to VesselMarkerContent.
 *
 * @param vessel - The vessel location data containing coordinates and vessel information
 * @param zIndex - Optional z-index value to control stacking order of markers
 *
 * @returns A Marker component containing a scaled vessel marker
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MapVesselMarker vessel={vessel} />
 *
 * // With custom z-index
 * <MapVesselMarker
 *   vessel={vessel}
 *   zIndex={5}
 * />
 * ```
 */
export const MapVesselMarker = ({
  vessel,
  zIndex,
}: {
  vessel: VesselLocation;
  zIndex?: number;
}) => {
  const markerScale = useMarkerScale(vessel.Latitude, vessel.Longitude);
  const mapPitch = useMapPitch();

  return (
    <Marker
      longitude={vessel.Longitude}
      latitude={vessel.Latitude}
      zIndex={zIndex}
    >
      <View
        style={{
          transform: [{ rotateX: `${mapPitch}deg` }, { scale: markerScale }],
        }}
      >
        <VesselMarkerContent vessel={vessel} />
      </View>
    </Marker>
  );
};
