import { ScrollView, StyleSheet, View } from "react-native";
import { Wave } from "../components/Wave";

/**
 * Waves screen demonstrating the papercraft aesthetic with layered,
 * undulating SVG waves. Examples include various color schemes and
 * wave configurations that can be stacked to create depth.
 */
export default function WavesScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Example 1: Blue Ocean Waves */}
      <View
        style={[
          styles.waveContainer,
          { height: 250, backgroundColor: "#f0f4f8" },
        ]}
      >
        <Wave
          height={80}
          period={2}
          color="#1e3a5f"
          offsetY={0}
          shadowColor="rgba(0, 0, 0, 0.12)"
          shadowOffset={{ x: 0, y: 6 }}
          shadowRadius={8}
          borderColor="rgba(0, 0, 0, 0.15)"
          borderWidth={1.5}
        />
        <Wave
          height={80}
          period={1.8}
          color="#2b5797"
          offsetY={40}
          phase={0.3}
          shadowColor="rgba(0, 0, 0, 0.09)"
          shadowOffset={{ x: 0, y: 5 }}
          shadowRadius={7}
          borderColor="rgba(0, 0, 0, 0.12)"
          borderWidth={1.5}
        />
        <Wave
          height={80}
          period={2.2}
          color="#5fa3d0"
          offsetY={80}
          phase={0.6}
          shadowColor="rgba(0, 0, 0, 0.06)"
          shadowOffset={{ x: 0, y: 4 }}
          shadowRadius={6}
          borderColor="rgba(0, 0, 0, 0.1)"
          borderWidth={1.5}
        />
        <Wave
          height={80}
          period={2}
          color="#87ceeb"
          offsetY={120}
          phase={0.1}
          shadowColor="rgba(0, 0, 0, 0.04)"
          shadowOffset={{ x: 0, y: 3 }}
          shadowRadius={5}
          borderColor="rgba(0, 0, 0, 0.08)"
          borderWidth={1.5}
        />
      </View>

      {/* Example 2: Deep Ocean with Gradients */}
      <View
        style={[
          styles.waveContainer,
          { height: 260, backgroundColor: "#0d1b2a", marginTop: 40 },
        ]}
      >
        <Wave
          height={70}
          period={1.5}
          color={{
            type: "linear",
            colors: ["#1b4965", "#2c5f7f"],
            start: { x: "0%", y: "10%" },
            end: { x: "0%", y: "0%" },
          }}
          offsetY={0}
          shadowColor="rgba(0, 0, 0, 0.25)"
          shadowOffset={{ x: 0, y: 7 }}
          shadowRadius={10}
          borderColor="rgba(255, 255, 255, 0.1)"
          borderWidth={2}
        />
        <Wave
          height={70}
          period={1.7}
          color={{
            type: "linear",
            colors: ["#3a7ca5", "#4a90b8"],
            start: { x: "0%", y: "10%" },
            end: { x: "0%", y: "0%" },
          }}
          offsetY={35}
          phase={0.4}
          shadowColor="rgba(0, 0, 0, 0.18)"
          shadowOffset={{ x: 0, y: 6 }}
          shadowRadius={8}
          borderColor="rgba(255, 255, 255, 0.12)"
          borderWidth={2}
        />
        <Wave
          height={70}
          period={1.9}
          color={{
            type: "linear",
            colors: ["#fff", "#76c7d9"],
            start: { x: "0%", y: "10%" },
            end: { x: "0%", y: "0%" },
          }}
          offsetY={70}
          phase={0.7}
          shadowColor="rgba(0, 0, 0, 0.12)"
          shadowOffset={{ x: 0, y: 5 }}
          shadowRadius={7}
          borderColor="rgba(255, 255, 255, 0.15)"
          borderWidth={2}
        />
        <Wave
          height={70}
          period={2.1}
          color={{
            type: "linear",
            colors: ["#a8dadc", "#bee5e7"],
            start: { x: "0%", y: "10%" },
            end: { x: "0%", y: "0%" },
          }}
          offsetY={105}
          phase={0.2}
          shadowColor="rgba(0, 0, 0, 0.07)"
          shadowOffset={{ x: 0, y: 4 }}
          shadowRadius={6}
          borderColor="rgba(255, 255, 255, 0.18)"
          borderWidth={2}
        />
        <Wave
          height={70}
          period={1.6}
          color={{
            type: "linear",
            colors: ["#cfe8ef", "#e0f4f7"],
            start: { x: "0%", y: "10%" },
            end: { x: "0%", y: "0%" },
          }}
          offsetY={140}
          phase={0.5}
          shadowColor="rgba(0, 0, 0, 0.05)"
          shadowOffset={{ x: 0, y: 3 }}
          shadowRadius={5}
          borderColor="rgba(255, 255, 255, 0.2)"
          borderWidth={2}
        />
      </View>

      {/* Example 3: Purple & Blue Sunset */}
      <View
        style={[
          styles.waveContainer,
          { height: 305, backgroundColor: "#fbd5c8", marginTop: 40 },
        ]}
      >
        <Wave
          height={75}
          period={2.3}
          color="#2e1a47"
          offsetY={0}
          shadowColor="rgba(0, 0, 0, 0.18)"
          shadowOffset={{ x: 0, y: 7 }}
          shadowRadius={9}
          borderColor="rgba(0, 0, 0, 0.2)"
          borderWidth={1.5}
        />
        <Wave
          height={75}
          period={2}
          color="#4a2c6d"
          offsetY={40}
          phase={0.25}
          shadowColor="rgba(0, 0, 0, 0.14)"
          shadowOffset={{ x: 0, y: 6 }}
          shadowRadius={8}
          borderColor="rgba(0, 0, 0, 0.18)"
          borderWidth={1.5}
        />
        <Wave
          height={75}
          period={2.5}
          color="#6b4e9e"
          offsetY={75}
          phase={0.5}
          shadowColor="rgba(0, 0, 0, 0.11)"
          shadowOffset={{ x: 0, y: 5 }}
          shadowRadius={7}
          borderColor="rgba(0, 0, 0, 0.15)"
          borderWidth={1.5}
        />
        <Wave
          height={75}
          period={1.8}
          color="#5fa8d3"
          offsetY={110}
          phase={0.75}
          shadowColor="rgba(0, 0, 0, 0.08)"
          shadowOffset={{ x: 0, y: 4 }}
          shadowRadius={6}
          borderColor="rgba(0, 0, 0, 0.12)"
          borderWidth={1.5}
        />
        <Wave
          height={75}
          period={2.2}
          color="#87ceeb"
          offsetY={145}
          phase={0.1}
          shadowColor="rgba(0, 0, 0, 0.05)"
          shadowOffset={{ x: 0, y: 3 }}
          shadowRadius={5}
          borderColor="rgba(0, 0, 0, 0.1)"
          borderWidth={1.5}
        />
        <Wave
          height={75}
          period={2}
          color="#a8dadc"
          offsetY={180}
          phase={0.4}
          shadowColor="rgba(0, 0, 0, 0.03)"
          shadowOffset={{ x: 0, y: 2 }}
          shadowRadius={4}
          borderColor="rgba(0, 0, 0, 0.08)"
          borderWidth={1.5}
        />
      </View>

      {/* Example 4: Teal & Turquoise */}
      <View
        style={[
          styles.waveContainer,
          {
            height: 200,
            backgroundColor: "#e8f5f7",
            marginTop: 40,
            marginBottom: 40,
          },
        ]}
      >
        <Wave
          height={60}
          period={1.6}
          color={{
            type: "linear",
            colors: ["#004d5c", "#006975"],
            start: { x: "0%", y: "0%" },
            end: { x: "0%", y: "100%" },
          }}
          offsetY={0}
          shadowColor="rgba(0, 0, 0, 0.14)"
          shadowOffset={{ x: 0, y: 6 }}
          shadowRadius={8}
          borderColor="rgba(0, 0, 0, 0.15)"
          borderWidth={1.5}
        />
        <Wave
          height={60}
          period={1.9}
          color={{
            type: "linear",
            colors: ["#008c9e", "#00a8b8"],
            start: { x: "0%", y: "0%" },
            end: { x: "0%", y: "100%" },
          }}
          offsetY={30}
          phase={0.3}
          shadowColor="rgba(0, 0, 0, 0.11)"
          shadowOffset={{ x: 0, y: 5 }}
          shadowRadius={7}
          borderColor="rgba(0, 0, 0, 0.12)"
          borderWidth={1.5}
        />
        <Wave
          height={60}
          period={2.1}
          color={{
            type: "linear",
            colors: ["#00bfcc", "#00d4db"],
            start: { x: "0%", y: "0%" },
            end: { x: "0%", y: "100%" },
          }}
          offsetY={60}
          phase={0.6}
          shadowColor="rgba(0, 0, 0, 0.08)"
          shadowOffset={{ x: 0, y: 4 }}
          shadowRadius={6}
          borderColor="rgba(0, 0, 0, 0.1)"
          borderWidth={1.5}
        />
        <Wave
          height={60}
          period={1.7}
          color={{
            type: "linear",
            colors: ["#5ce1e6", "#7ee8eb"],
            start: { x: "0%", y: "0%" },
            end: { x: "0%", y: "100%" },
          }}
          offsetY={90}
          phase={0.15}
          shadowColor="rgba(0, 0, 0, 0.05)"
          shadowOffset={{ x: 0, y: 3 }}
          shadowRadius={5}
          borderColor="rgba(0, 0, 0, 0.08)"
          borderWidth={1.5}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  contentContainer: {
    paddingVertical: 20,
  },
  waveContainer: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderRadius: 8,
    marginHorizontal: 20,
    alignSelf: "center",
    maxWidth: 800,
  },
});
