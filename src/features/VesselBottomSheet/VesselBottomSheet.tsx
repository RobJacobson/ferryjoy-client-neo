import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import type { VesselLocation } from "@/domain";

interface VesselBottomSheetProps {
  selectedVessel: VesselLocation | null;
}

export const VesselBottomSheet = forwardRef<
  BottomSheet,
  VesselBottomSheetProps
>(({ selectedVessel }, ref) => {
  // variables
  const snapPoints = useMemo(() => ["25%", "50%"], []);

  // callbacks
  const handleSheetChanges = useCallback((index: number) => {
    console.log("handleSheetChanges", index);
  }, []);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
    >
      <BottomSheetView style={styles.contentContainer}>
        <Text style={styles.containerHeadline}>
          {selectedVessel ? selectedVessel.VesselName : "Select a vessel"}
        </Text>
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    alignItems: "center",
    padding: 16,
  },
  containerHeadline: {
    fontSize: 24,
    fontWeight: "600",
    padding: 20,
  },
});
