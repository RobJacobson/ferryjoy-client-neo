import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { forwardRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useConvexVesselPings } from "@/data/contexts";
import type { VesselLocation } from "@/domain";

interface VesselBottomSheetProps {
  selectedVessel: VesselLocation | null;
}

export const VesselBottomSheet = forwardRef<
  BottomSheet,
  VesselBottomSheetProps
>(({ selectedVessel }, ref) => {
  // variables
  const snapPoints = ["25%", "50%", "75%"];
  const { vesselPingsByVesselId, isLoading, error } = useConvexVesselPings();

  // callbacks
  const handleSheetChanges = (index: number) => {
    console.log("handleSheetChanges", index);
  };

  const vesselPings = selectedVessel
    ? vesselPingsByVesselId[selectedVessel.VesselID] || []
    : [];

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
    >
      <BottomSheetView style={styles.contentContainer}>
        {!selectedVessel ? (
          <Text style={styles.containerHeadline}>Select a vessel</Text>
        ) : (
          <View style={{ flex: 1, width: "100%" }}>
            <View style={styles.header}>
              <Text style={styles.containerHeadline}>
                {selectedVessel.VesselName}
              </Text>
              <Text style={styles.subtitle}>
                Vessel ID: {selectedVessel.VesselID}
              </Text>
              <Text style={styles.subtitle}>
                Total pings: {vesselPings.length}
              </Text>
            </View>

            {isLoading ? (
              <Text style={styles.loadingText}>Loading vessel pings...</Text>
            ) : error ? (
              <Text style={styles.errorText}>Error: {error}</Text>
            ) : vesselPings.length === 0 ? (
              <Text style={styles.noDataText}>
                No pings data available for this vessel
              </Text>
            ) : (
              <View style={styles.pingsContainer}>
                <Text style={styles.sectionTitle}>
                  All Pings ({vesselPings.length})
                </Text>
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableCell, styles.headerCell]}>
                      Time
                    </Text>
                    <Text style={[styles.tableCell, styles.headerCell]}>
                      Position
                    </Text>
                    <Text style={[styles.tableCell, styles.headerCell]}>
                      Speed
                    </Text>
                    <Text style={[styles.tableCell, styles.headerCell]}>
                      Status
                    </Text>
                  </View>
                  <FlatList
                    data={vesselPings}
                    keyExtractor={(ping, index) =>
                      `${ping.TimeStamp.getTime()}-${index}`
                    }
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item: ping }) => (
                      <View style={styles.tableRow}>
                        <Text style={styles.tableCell}>
                          {ping.TimeStamp.toLocaleTimeString()}
                        </Text>
                        <Text style={styles.tableCell}>
                          {ping.Latitude.toFixed(4)},{" "}
                          {ping.Longitude.toFixed(4)}
                        </Text>
                        <Text style={styles.tableCell}>
                          {ping.Speed}kn {ping.Heading}°
                        </Text>
                        <Text
                          style={[
                            styles.tableCell,
                            styles.statusCell,
                            { color: ping.AtDock ? "#ff6b6b" : "#51cf66" },
                          ]}
                        >
                          {ping.AtDock ? "Docked" : "Sailing"}
                        </Text>
                      </View>
                    )}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  containerHeadline: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
    marginTop: 20,
  },
  noDataText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  pingsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#ffffff",
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 12,
    textAlign: "center",
  },
  headerCell: {
    fontWeight: "600",
    color: "#495057",
    backgroundColor: "#f8f9fa",
  },
  statusCell: {
    fontWeight: "600",
  },
});
