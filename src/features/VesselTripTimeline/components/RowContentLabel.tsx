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

type RowContentLabelProps = {
  startLabel?: BoundaryLabel;
};

/**
 * Renders the start boundary label for a segment.
 *
 * @param startLabel - Start boundary label when present
 * @returns Label view
 */
export const RowContentLabel = ({ startLabel }: RowContentLabelProps) => {
  if (!startLabel) {
    return null;
  }

  return (
    <View className="mt-[-14px] flex-1 justify-start">
      {renderBoundaryLabel(startLabel)}
    </View>
  );
};

/**
 * Renders a single boundary label when terminal data is available.
 *
 * @param boundaryLabel - Display copy plus canonical terminal abbreviation
 * @returns Boundary label block or null
 */
const renderBoundaryLabel = (boundaryLabel: BoundaryLabel | undefined) => {
  if (!boundaryLabel?.terminalAbbrev) {
    return null;
  }

  const terminalName =
    getTerminalNameByAbbrev(boundaryLabel.terminalAbbrev) ??
    boundaryLabel.terminalAbbrev;

  return (
    <View className="items-start">
      <Text className="text-xs uppercase">{boundaryLabel.label}</Text>
      <Text>{terminalName}</Text>
    </View>
  );
};
