import { BlurTargetView, BlurView } from "expo-blur";
import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  const targetRef = useRef<View | null>(null);
  const text = "Hello, my container is blurring contents underneath!";

  return (
    <View style={styles.container}>
      <BlurTargetView ref={targetRef} style={styles.background}>
        {[...Array(20).keys()].map((i) => (
          <View
            key={`box-${i}`}
            style={[styles.box, i % 2 === 1 ? styles.boxOdd : styles.boxEven]}
          />
        ))}
      </BlurTargetView>
      <BlurView
        blurTarget={targetRef}
        intensity={100}
        style={styles.blurContainer}
        blurMethod="dimezisBlurView"
      >
        <Text style={styles.text}>{text}</Text>
      </BlurView>
      <BlurView
        blurTarget={targetRef}
        intensity={80}
        tint="light"
        style={styles.blurContainer}
        blurMethod="dimezisBlurView"
      >
        {/* <Text style={styles.text}>{text}</Text> */}
      </BlurView>
      <BlurView
        blurTarget={targetRef}
        intensity={90}
        tint="dark"
        style={styles.blurContainer}
        blurMethod="dimezisBlurView"
      >
        <Text style={[styles.text, { color: "#fff" }]}>{text}</Text>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blurContainer: {
    flex: 1,
    padding: 20,
    margin: 16,
    textAlign: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 20,
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
  text: {
    fontSize: 24,
    fontWeight: "600",
  },
});
