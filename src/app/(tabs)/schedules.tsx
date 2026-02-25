import { UnifiedTripsProvider, useSelectedTerminalPair } from "@/data/contexts";
import { getRouteAbbrevsForSelection } from "@/data/terminalRouteMapping";
import {
  ScheduledTripList,
  useUnifiedTripsPageData,
} from "@/features/TimelineFeatures/ScheduledTrips";
import { getSailingDay } from "@/shared/utils/getSailingDay";

export default function SchedulesScreen() {
  const { selectedTerminalPair } = useSelectedTerminalPair();

  const routeAbbrevs = getRouteAbbrevsForSelection(selectedTerminalPair);
  const tripDate = getSailingDay(new Date());

  const terminalAbbrev =
    selectedTerminalPair?.kind === "pair"
      ? selectedTerminalPair.from
      : selectedTerminalPair?.kind === "all"
        ? selectedTerminalPair.terminal
        : "P52";

  const destinationAbbrev =
    selectedTerminalPair?.kind === "pair"
      ? selectedTerminalPair.dest
      : undefined;

  return (
    <UnifiedTripsProvider routeAbbrevs={routeAbbrevs} tripDate={tripDate}>
      <SchedulesContent
        terminalAbbrev={terminalAbbrev}
        destinationAbbrev={destinationAbbrev}
      />
    </UnifiedTripsProvider>
  );
}

/**
 * Inner component that fetches page data and renders ScheduledTripList.
 * Must live inside UnifiedTripsProvider to use useUnifiedTripsPageData.
 */
const SchedulesContent = ({
  terminalAbbrev,
  destinationAbbrev,
}: {
  terminalAbbrev: string;
  destinationAbbrev?: string;
}) => {
  const pageData = useUnifiedTripsPageData({
    terminalAbbrev,
    destinationAbbrev,
  });
  return <ScheduledTripList {...pageData} />;
};
