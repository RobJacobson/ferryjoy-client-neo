import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

export type TerminalOrRouteBottomSheetProps = {
  title: string;
  kind: "terminal" | "route";
  snapPoints?: readonly (string | number)[];
  initialIndex?: number;
};

export const TerminalOrRouteBottomSheet = ({
  title,
  kind,
  snapPoints: snapPointsProp,
  initialIndex = 0,
}: TerminalOrRouteBottomSheetProps) => {
  const snapPoints = useMemo<(string | number)[]>(() => {
    // BottomSheet expects a mutable array type; spread ensures we don't pass readonly arrays through.
    return [...(snapPointsProp ?? ["25%", "50%", "85%"])];
  }, [snapPointsProp]);

  return (
    <BottomSheet
      index={initialIndex}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
    >
      <BottomSheetView style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {kind === "terminal" ? "Terminal" : "Route"} details (placeholder)
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.bodyText}>
            This bottom sheet is a placeholder. Next steps: show arrivals,
            alerts, and related destinations.
          </Text>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  body: {
    flex: 1,
  },
  bodyText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
});
