/**
 * MapVesselMarkers component
 * Renders vessel markers on map using data from VesselLocations context
 */

import { Text, View } from "react-native"
import type { VesselLocation } from "ws-dottie/wsf-vessels"
import { useMapState, useWsDottie } from "@/shared/contexts"
import { VesselMarker } from "./VesselMarker"

/**
 * Determines whether vessels should be shown based on the current zoom level
 *
 * @param zoom - The current map zoom level
 * @returns True if vessels should be displayed, false otherwise
 *
 * @example
 * ```tsx
 * const showVessels = shouldShowVessels(10); // Returns true
 * const hideVessels = shouldShowVessels(5); // Returns false
 * ```
 */
const shouldShowVessels = (zoom: number): boolean =>
  zoom >= VESSEL_MARKER_CONFIG.ZOOM_THRESHOLD

/**
 * MapVesselMarkers component
 *
 * Fetches vessel data from the WsDottie context and renders markers on the map.
 * Handles loading states, error states, and visibility based on zoom level.
 * Each vessel is rendered as a VesselMarker component with a blue circular indicator.
 *
 * @param onVesselPress - Optional callback function triggered when a vessel marker is pressed
 *
 * @returns React elements representing vessel markers or null if vessels should not be displayed
 *
 * @example
 * ```tsx
 * // Basic usage without press handler
 * <MapVesselMarkers />
 *
 * // With press handler
 * <MapVesselMarkers
 *   onVesselPress={(vessel) => navigation.navigate('VesselDetails', { vesselId: vessel.VesselID })}
 * />
 * ```
 */
export const MapVesselMarkers = ({
  onVesselPress,
}: {
  onVesselPress?: (vessel: VesselLocation) => void
}) => {
  const { zoom } = useMapState()
  const { vesselLocations } = useWsDottie()

  // Handle loading state
  if (vesselLocations.isLoading) {
    return null
  }

  // Handle error state
  if (vesselLocations.isError) {
    console.error("Error loading vessel locations:", vesselLocations.error)
    return null
  }

  // Handle empty data
  if (!vesselLocations.data || vesselLocations.data.length === 0) {
    return null
  }

  // Only show vessels when zoomed in enough
  if (!shouldShowVessels(zoom)) {
    return null
  }

  return (
    <>
      {vesselLocations.data.map((vessel: VesselLocation) => {
        return (
          <VesselMarker
            key={`${vessel.VesselID}`}
            vessel={vessel}
            onPress={onVesselPress}
          >
            <View className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white justify-center items-center">
              <View className="w-2 h-2 bg-white rounded-full">
                <Text>Hi!</Text>
              </View>
            </View>
          </VesselMarker>
        )
      })}
    </>
  )
}

/**
 * Configuration constants for vessel markers
 */
const VESSEL_MARKER_CONFIG = {
  ZOOM_THRESHOLD: 8,
} as const
