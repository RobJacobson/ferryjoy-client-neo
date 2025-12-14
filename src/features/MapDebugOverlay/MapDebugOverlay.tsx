import { Text, View } from "react-native";
import { useMapState } from "@/data/contexts";

export const MapDebugOverlay = () => {
  const { cameraState } = useMapState();

  const [lon, lat] = cameraState.centerCoordinate;
  const zoom = cameraState.zoomLevel;
  const bearing = cameraState.heading;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        backgroundColor: "rgba(0,0,0,0.55)",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
      }}
    >
      <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>
        lat {lat.toFixed(4)} lon {lon.toFixed(4)}
      </Text>
      <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>
        zoom {zoom.toFixed(2)} bearing {Math.round(bearing)}°
      </Text>
    </View>
  );
};
