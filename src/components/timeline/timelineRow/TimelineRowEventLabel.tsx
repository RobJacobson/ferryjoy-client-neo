/**
 * Left-column event label for timeline rows.
 */

import { Text, View } from "@/components/ui";
import type { TimelineRenderBoundary } from "../types";
import { TimelineShadowText } from "./TimelineShadowText";

type TimelineRowEventLabelProps = {
  boundary: TimelineRenderBoundary;
};

/**
 * Renders event label text and terminal name for a timeline row boundary.
 *
 * @param label - The boundary containing event and terminal data
 * @returns The label view or a spacer when no display text is available
 */
export const TimelineRowEventLabel = ({
  boundary,
}: TimelineRowEventLabelProps) => {
  const terminalDisplayName = boundary.currTerminalDisplayName;

  const labelText =
    boundary.eventType === "arrive"
      ? boundary.currTerminalAbbrev
        ? `Arrive ${boundary.currTerminalAbbrev}`
        : "Arrive"
      : boundary.eventType === "depart"
        ? boundary.nextTerminalAbbrev
          ? `To ${boundary.nextTerminalAbbrev}`
          : "Depart"
        : undefined;

  return (
    <View className="relative mx-2 mt-[-8px] flex flex-1 flex-row">
      {terminalDisplayName && boundary.eventType === "arrive" && (
        <View className="absolute -top-8 -left-3 -rotate-[9deg]">
          <TimelineShadowText>
            <Text className="font-puffberry text-3xl text-purple-400">
              {terminalDisplayName}
            </Text>
          </TimelineShadowText>
        </View>
      )}
      <View className="flex flex-1 flex-row justify-end">
        <TimelineShadowText>
          <Text className="font-led-board text-purple-700">{labelText}</Text>
        </TimelineShadowText>
      </View>
    </View>
  );
};
