/**
 * Card-level vessel trip timeline presentation using timeline primitives.
 */

import { useMemo } from "react";
import { Text, View } from "@/components/ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTerminalsData } from "@/data/contexts";
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
  const nowMs = useNowMs(1000);
  const terminalsData = useTerminalsData();
  const item = { trip, vesselLocation };
  const getTerminalName = useMemo(
    () => (terminalAbbrev: string) =>
      terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()]
        ?.TerminalName ?? null,
    [terminalsData]
  );
  const renderState = getTimelineRenderState(
    item,
    getTerminalName,
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
