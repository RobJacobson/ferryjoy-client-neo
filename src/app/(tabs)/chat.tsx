import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";

const DEMO_TEXT = "Hello, my container is blurring contents underneath!";

/**
 * Blur overlay that works on all platforms. On web, expo-blur's native
 * BlurView is unimplemented (ViewManagerAdapter_ExpoBlurView); we use a
 * View with CSS backdrop-filter instead. On iOS/Android we use BlurView.
 */
function BlurOverlay({
  children,
  intensity = 50,
  tint = "default",
  style,
}: {
  children: ReactNode;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  style?: ViewStyle | ViewStyle[];
}) {
  // if (Platform.OS === "web") {
  //   const opacity = Math.min(intensity / 100, 1) * 0.4;
  //   const bg =
  //     tint === "dark"
  //       ? `rgba(0,0,0,${opacity})`
  //       : tint === "light"
  //         ? `rgba(255,255,255,${opacity})`
  //         : `rgba(128,128,128,${opacity})`;
  //   const blurPx = Math.min(intensity * 0.3, 24);
  //   return (
  //     <View
  //       style={[
  //         style,
  //         {
  //           backgroundColor: bg,
  //           // backdropFilter / WebkitBackdropFilter are supported in react-native-web
  //           ...({
  //             backdropFilter: `saturate(180%) blur(${blurPx}px)`,
  //             WebkitBackdropFilter: `saturate(180%) blur(${blurPx}px)`,
  //           } as ViewStyle),
  //         },
  //       ]}
  //     >
  //       {children}
  //     </View>
  //   );
  // }
  return (
    <BlurView intensity={intensity} tint={tint} style={style}>
      {children}
    </BlurView>
  );
}

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.background}>
        {[...Array(20).keys()].map((i) => (
          <View
            key={`box-${i}`}
            style={[styles.box, i % 2 === 1 ? styles.boxOdd : styles.boxEven]}
          />
        ))}
      </View>
      <BlurOverlay
        intensity={100}
        style={[styles.blurContainer, styles.blurFirst]}
      >
        <Text style={styles.text}>{DEMO_TEXT}</Text>
      </BlurOverlay>
      <BlurOverlay
        intensity={80}
        tint="light"
        style={[styles.blurContainer, styles.blurSecond]}
      >
        <Text style={styles.text}>{DEMO_TEXT}</Text>
      </BlurOverlay>
      <BlurOverlay
        intensity={90}
        tint="dark"
        style={[styles.blurContainer, styles.blurThird]}
      >
        <Text style={[styles.text, styles.textLight]}>{DEMO_TEXT}</Text>
      </BlurOverlay>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    flexWrap: "wrap",
    ...StyleSheet.absoluteFill,
  },
  box: {
    width: "25%",
    height: "20%",
  },
  boxEven: {
    backgroundColor: "orangered",
  },
  boxOdd: {
    backgroundColor: "gold",
  },
  blurContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    padding: 20,
    textAlign: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 20,
  },
  blurFirst: {
    top: 48,
    height: "28%",
  },
  blurSecond: {
    top: "35%",
    height: "28%",
  },
  blurThird: {
    top: "68%",
    height: "28%",
  },
  text: {
    fontSize: 24,
    fontWeight: "600",
  },
  textLight: {
    color: "#fff",
  },
});

// import { View } from "react-native";
// import { Text } from "@/components/ui";
// import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
// import { VesselTimeline } from "@/features/TimelineFeatures/VesselTimeline";

// /**
//  * ChatScreen serves as a placeholder to demonstrate the new VesselTripTimelineVertical.
//  * It picks the first available vessel with location data and displays its daily timeline.
//  */
// export default function ChatScreen() {
//   const { vesselLocations, isLoading } = useConvexVesselLocations();

//   // Pick a vessel to demo (e.g., the first one in the list)
//   const demoVessel = vesselLocations?.[0];

//   return (
//     <View className="flex-1 bg-background">
//       <View className="px-6 pt-12 pb-4 border-b border-border bg-card">
//         <Text className="text-2xl font-playpen-600 text-primary">
//           Vessel Daily Log
//         </Text>
//         <Text className="text-sm text-muted-foreground">
//           {demoVessel
//             ? `Viewing ${demoVessel.VesselName} (${demoVessel.VesselAbbrev})`
//             : "Loading vessel data..."}
//         </Text>
//       </View>

//       {demoVessel ? (
//         <VesselTimeline
//           vesselAbbrev={demoVessel.VesselAbbrev}
//           vesselLocation={demoVessel}
//           className="flex-1"
//         />
//       ) : (
//         <View className="flex-1 items-center justify-center p-8">
//           <Text className="text-muted-foreground text-center">
//             {isLoading
//               ? "Connecting to Convex..."
//               : "No active vessel locations found to display a timeline."}
//           </Text>
//         </View>
//       )}
//     </View>
//   );
// }
