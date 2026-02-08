import { useSelectedTerminalPair } from "@/data/contexts";
import { ScheduledTripList } from "@/features/TimelineFeatures/ScheduledTrips";

export default function SchedulesScreen() {
  const { selectedTerminalPair } = useSelectedTerminalPair();

  // Determine which terminal to show based on selection context
  const terminalAbbrev =
    selectedTerminalPair?.kind === "pair"
      ? selectedTerminalPair.from
      : selectedTerminalPair?.kind === "all"
        ? selectedTerminalPair.terminal
        : "P52"; // Default to Seattle if nothing selected

  const destinationAbbrev =
    selectedTerminalPair?.kind === "pair"
      ? selectedTerminalPair.dest
      : undefined;

  return (
    <ScheduledTripList
      terminalAbbrev={terminalAbbrev}
      destinationAbbrev={destinationAbbrev}
    />
  );
}
