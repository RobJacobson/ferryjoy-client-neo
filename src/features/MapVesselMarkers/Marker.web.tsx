/**
 * Web marker component for vessel markers
 *
 * This component provides a web-specific implementation of vessel markers by wrapping
 * the react-map-gl Marker component. It abstracts platform differences and provides
 * a consistent interface for rendering markers on web platforms. This component
 * should only contain platform-specific code for web implementations.
 *
 * @example
 * ```tsx
 * import { Marker } from '@/features/MapVesselMarkers/Marker.web';
 *
 * const MyMapComponent = ({ vessel }) => {
 *   return (
 *     <Marker longitude={vessel.Longitude} latitude={vessel.Latitude}>
 *       <View style={styles.marker}>
 *         <Text>{vessel.Name}</Text>
 *       </View>
 *     </Marker>
 *   );
 * };
 * ```
 */

import type { ReactElement } from "react"
import { Marker as MapboxMarker } from "react-map-gl/mapbox"

/**
 * Web marker component that wraps react-map-gl Marker
 *
 * This component provides a web-specific implementation of vessel markers by wrapping
 * the react-map-gl Marker component. It handles the positioning and anchoring of
 * markers on the map for web platforms.
 *
 * @param longitude - The longitude coordinate where the marker should be placed
 * @param latitude - The latitude coordinate where the marker should be placed
 * @param children - React elements to be rendered inside the marker
 *
 * @returns A MapboxMarker component positioned at the specified coordinates
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Marker longitude={-122.4194} latitude={37.7749}>
 *   <View style={styles.marker}>
 *     <Text>San Francisco</Text>
 *   </View>
 * </Marker>
 *
 * // With vessel data
 * <Marker longitude={vessel.Longitude} latitude={vessel.Latitude}>
 *   <View style={styles.vesselMarker}>
 *     <Text>{vessel.Name}</Text>
 *   </View>
 * </Marker>
 * ```
 */
export const Marker = ({
  longitude,
  latitude,
  children,
}: {
  longitude: number
  latitude: number
  children: ReactElement
}) => {
  return (
    <MapboxMarker longitude={longitude} latitude={latitude} anchor="center">
      {children}
    </MapboxMarker>
  )
}
