/**
 * VesselMarker component
 *
 * An intermediate vessel marker component that handles business logic such as press events
 * and logging. It wraps the platform-specific Marker component with a Pressable component
 * to provide interactive functionality. This component serves as a bridge between the
 * platform-specific marker implementation and the higher-level MapVesselMarkers component.
 *
 * @example
 * ```tsx
 * import { VesselMarker } from '@/features/MapVesselMarkers';
 *
 * const MyComponent = ({ vessel }) => {
 *   const handlePress = (vessel) => {
 *     console.log('Vessel pressed:', vessel.VesselID);
 *   };
 *
 *   return (
 *     <VesselMarker vessel={vessel} onPress={handlePress}>
 *       <View style={styles.marker}>
 *         <Text>Vessel</Text>
 *       </View>
 *     </VesselMarker>
 *   );
 * };
 * ```
 */

import { Pressable, View } from "react-native"
import type { VesselLocation } from "ws-dottie/wsf-vessels"
import { Marker } from "./Marker"

/**
 * Creates a vessel press handler with logging functionality
 *
 * This function generates a press handler that logs vessel information when a marker
 * is pressed and optionally calls a provided callback function. This centralizes
 * the press handling logic and ensures consistent logging across all vessel markers.
 *
 * @param vessel - The vessel location data object
 * @param onVesselPress - Optional callback function to be called when the vessel is pressed
 * @returns A function that handles press events for the vessel
 *
 * @example
 * ```tsx
 * const handlePress = createVesselPressHandler(vessel, (v) => {
 *   navigation.navigate('VesselDetails', { vesselId: v.VesselID });
 * });
 *
 * // Later use as onPress handler
 * <Pressable onPress={handlePress}>
 *   <Text>Press me</Text>
 * </Pressable>
 * ```
 */
const createVesselPressHandler = (
  vessel: VesselLocation,
  onVesselPress?: (vessel: VesselLocation) => void
) => {
  return () => {
    // Log vessel information when clicked for debugging and analytics
    console.log(`Vessel marker clicked: ${vessel.VesselID}`)

    // Call the provided onPress handler if it exists
    onVesselPress?.(vessel)
  }
}

/**
 * VesselMarker component that handles business logic for vessel markers
 *
 * This component wraps the platform-specific Marker with a Pressable component
 * to provide interactive functionality. It handles press events, logging, and
 * ensures the marker content is properly wrapped in a React element.
 *
 * @param vessel - The vessel location data containing coordinates and vessel information
 * @param onPress - Optional callback function triggered when the vessel marker is pressed
 * @param children - React elements to be rendered inside the marker
 *
 * @returns A Marker component with pressable functionality
 *
 * @example
 * ```tsx
 * // Basic usage
 * <VesselMarker vessel={vessel}>
 *   <View style={styles.marker}>
 *     <Text>{vessel.Name}</Text>
 *   </View>
 * </VesselMarker>
 *
 * // With press handler
 * <VesselMarker
 *   vessel={vessel}
 *   onPress={(v) => showVesselDetails(v.VesselID)}
 * >
 *   <View style={styles.marker}>
 *     <Text>{vessel.Name}</Text>
 *   </View>
 * </VesselMarker>
 * ```
 */
export const VesselMarker = ({
  vessel,
  onPress,
  children,
}: {
  vessel: VesselLocation
  onPress?: (vessel: VesselLocation) => void
  children: React.ReactNode
}) => {
  const handlePress = createVesselPressHandler(vessel, onPress)

  // Wrap children in a View to ensure it's a ReactElement
  // This is required because the Marker component expects a ReactElement as children
  const markerContent = <View>{children}</View>

  return (
    <Marker longitude={vessel.Longitude} latitude={vessel.Latitude}>
      <Pressable onPress={handlePress}>{markerContent}</Pressable>
    </Marker>
  )
}
