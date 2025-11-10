/**
 * MapComponentTest - Minimum viable map component using rnmapbox
 *
 * This is a simple test component to verify that rnmapbox is working correctly
 * in the native environment. It uses basic MapView and Camera components
 * from @rnmapbox/maps with minimal configuration.
 */

import * as MapboxRN from "@rnmapbox/maps"
import { StyleSheet, View } from "react-native"
import { MAP_STYLES, SEATTLE_COORDINATES } from "./MapComponent/shared"

// Set your Mapbox access token
// In a production app, this should be stored securely and not hardcoded
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || ""
if (!accessToken) {
  console.warn(
    "MapComponentTest: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set. Map may not load correctly."
  )
}
MapboxRN.setAccessToken(accessToken)

/**
 * MapComponentTest - A minimal map component for testing rnmapbox
 *
 * This component displays a basic map centered on Seattle with the streets style.
 * It's designed to be a simple test to verify that rnmapbox is working correctly.
 */
const MapComponentTest = () => {
  const handleMapReady = () => {
    console.log("Map is ready")
  }

  const handleMapError = () => {
    console.error("Map failed to load")
  }

  return (
    <View style={styles.container}>
      <MapboxRN.MapView
        style={styles.map}
        styleURL={MAP_STYLES.STREETS}
        onDidFinishLoadingMap={handleMapReady}
        onMapLoadingError={handleMapError}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        <MapboxRN.Camera
          defaultSettings={{
            centerCoordinate: [
              SEATTLE_COORDINATES.longitude,
              SEATTLE_COORDINATES.latitude,
            ],
            zoomLevel: 12,
            pitch: 45,
            heading: 0,
          }}
        />
      </MapboxRN.MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
})

export default MapComponentTest
