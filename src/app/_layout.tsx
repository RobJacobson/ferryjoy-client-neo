import "../../global.css";

import Mapbox from "@rnmapbox/maps";
import { Stack } from "expo-router";
import { Providers } from "@/data/Providers";

// Set Mapbox access token
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
if (!accessToken) {
  console.warn(
    "App Layout: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set. Map may not load correctly."
  );
}
Mapbox.setAccessToken(accessToken);

export default function Layout() {
  return (
    <Providers>
      <Stack />
    </Providers>
  );
}
