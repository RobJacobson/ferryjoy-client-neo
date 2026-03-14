/**
 * Left-column event label for timeline rows (terminal name, arriving/departing).
 */

import { Text, View } from "@/components/ui";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import type { TimelineRenderBoundary } from "./types";

type TimelineRowEventLabelProps = {
  label?: TimelineRenderBoundary;
};

/**
 * Renders the event label for a timeline row boundary (terminal name + Arv/Dep).
 *
 * @param label - The boundary containing terminal abbrev and event label (Arv/Dep)
 * @returns The label view or null if no terminal abbrev
 */
export const TimelineRowEventLabel = ({
  label,
}: TimelineRowEventLabelProps) => {
  if (!label?.terminalAbbrev) {
    return <View className="flex-1 justify-start" />;
  }

  const terminalName = getDisplayTerminalName(label.terminalAbbrev);
  const eventLabel = getEventLabel(label.label);

  return (
    <View className="flex-1 justify-start">
      <View className="relative mt-[-12px] flex flex-row">
        {label.label === "Arv" && (
          <View className="absolute top-[-14px] left-0 -rotate-[9deg] transform">
            <Text className="font-puffberry text-3xl text-purple-300">
              {terminalName}
            </Text>
          </View>
        )}
        <View className="flex flex-row items-center">
          <Text className="ml-12 font-bitcount-400 text-lg text-purple-800">
            {eventLabel}
          </Text>
        </View>
      </View>
    </View>
  );
};

const getDisplayTerminalName = (terminalAbbrev?: string) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  return terminalName
    ?.replace("Island", "Is.")
    .replace("Port", "Pt.")
    .replace("Point", "Pt.");
};

const getEventLabel = (label: string) =>
  label === "Arv" ? "Arriving" : label === "Dep" ? "Departing" : label;
