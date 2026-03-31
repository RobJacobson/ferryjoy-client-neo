/**
 * Card-level vessel trip timeline presentation using timeline primitives.
 */

import { Text, View } from "@/components/ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useIdentityCatalog } from "@/data/contexts";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import { useNowMs } from "@/shared/hooks";
import { TimelineContent } from "./components/TimelineContent";
import type { TimelineItem } from "./types";
import { getTimelineRenderState } from "./utils";
import { VesselTripCardTitle } from "./VesselTripCardTitle";

type VesselTripTimelineProps = TimelineItem;

/**
 * Renders a single vessel trip as a styled timeline card.
 *
 * @param props - Vessel trip and location pair
 * @returns Card with route heading and vertical timeline
 */
export const VesselTripTimeline = ({
  trip,
  vesselLocation,
}: VesselTripTimelineProps) => {
  useIdentityCatalog();
  const nowMs = useNowMs(1000);
  const item = { trip, vesselLocation };
  const renderState = getTimelineRenderState(
    item,
    getTerminalNameByAbbrev,
    new Date(nowMs)
  );

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="gap-1">
        <View className="items-start">
          <VesselTripCardTitle trip={trip} />
          <Text className="font-medium text-emerald-700 text-xs uppercase leading-4">
            {vesselLocation.VesselName}
          </Text>
        </View>
      </CardHeader>
      <CardContent className="px-4">
        <TimelineContent {...renderState} />
      </CardContent>
    </Card>
  );
};
