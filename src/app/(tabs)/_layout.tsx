import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <NativeTabs tintColor="#007AFF">
      <NativeTabs.Trigger name="map">
        <Label>Map</Label>
        {Platform.OS === "ios" ? (
          <Icon sf={{ default: "map", selected: "map.fill" }} />
        ) : (
          <Icon src={<VectorIcon family={Ionicons} name="map-outline" />} />
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="terminals">
        <Label>Terminals</Label>
        {Platform.OS === "ios" ? (
          <Icon
            sf={{ default: "mappin.circle", selected: "mappin.circle.fill" }}
          />
        ) : (
          <Icon
            src={<VectorIcon family={Ionicons} name="location-outline" />}
          />
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="vessels">
        <Label>Vessels</Label>
        {Platform.OS === "ios" ? (
          <Icon sf={{ default: "sailboat", selected: "sailboat.fill" }} />
        ) : (
          <Icon src={<VectorIcon family={Ionicons} name="boat-outline" />} />
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedules">
        <Label>Schedules</Label>
        {Platform.OS === "ios" ? (
          <Icon
            sf={{ default: "calendar", selected: "calendar.circle.fill" }}
          />
        ) : (
          <Icon
            src={<VectorIcon family={Ionicons} name="calendar-outline" />}
          />
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chat">
        <Label>Chat</Label>
        {Platform.OS === "ios" ? (
          <Icon
            sf={{
              default: "bubble.left.and.bubble.right",
              selected: "bubble.left.and.bubble.right.fill",
            }}
          />
        ) : (
          <Icon
            src={<VectorIcon family={Ionicons} name="chatbubbles-outline" />}
          />
        )}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
