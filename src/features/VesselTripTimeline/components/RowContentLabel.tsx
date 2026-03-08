/**
 * Reusable label content for timeline row slots.
 * Renders one or two boundary labels for a timeline segment.
 */

import { Text, View } from "@/components/ui";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";

export type BoundaryLabel = {
  label: string;
  terminalAbbrev?: string;
};

type RowContentLabelProps = {
  startLabel?: BoundaryLabel;
  endLabel?: BoundaryLabel;
};

/**
 * Renders one or two boundary labels for a segment.
 *
 * @param startLabel - Required top boundary label when present
 * @param endLabel - Optional bottom boundary label for the last segment
 * @returns Label view
 */
export const RowContentLabel = ({
  startLabel,
  endLabel,
}: RowContentLabelProps) => {
  if (!startLabel && !endLabel) {
    return null;
  }

  return (
    <View className="mt-[-14px] flex-1 justify-between">
      {renderBoundaryLabel(startLabel)}
      {renderBoundaryLabel(endLabel)}
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
