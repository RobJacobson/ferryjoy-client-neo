/**
 * Reusable label content for timeline row slots.
 * Renders the start boundary label for a timeline segment.
 */

import { Text, View } from "@/components/ui";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";

type BoundaryLabel = {
  label: string;
  terminalAbbrev?: string;
};

type TimelineRowContentLabelProps = {
  startLabel?: BoundaryLabel;
};

/**
 * Renders the start boundary label for a segment.
 *
 * @param startLabel - Start boundary label when present
 * @returns Label view
 */
export const TimelineRowContentLabel = ({
  startLabel,
}: TimelineRowContentLabelProps) => {
  if (!startLabel?.terminalAbbrev) {
    return null;
  }

  const terminalName = getTerminalDisplayName(startLabel.terminalAbbrev);

  return (
    <View className="mt-[-14px] flex-1 justify-start">
      <View className="items-start">
        <Text className="text-xs uppercase">{startLabel.label}</Text>
        <Text>{terminalName}</Text>
      </View>
    </View>
  );
};

/**
 * Resolves a canonical terminal abbreviation into a display name.
 *
 * @param terminalAbbrev - Canonical terminal abbreviation
 * @returns Human-readable terminal name or the abbreviation when unknown
 */
const getTerminalDisplayName = (
  terminalAbbrev: string | undefined
): string | undefined => {
  if (!terminalAbbrev) {
    return undefined;
  }

  return getTerminalNameByAbbrev(terminalAbbrev) ?? terminalAbbrev;
};
