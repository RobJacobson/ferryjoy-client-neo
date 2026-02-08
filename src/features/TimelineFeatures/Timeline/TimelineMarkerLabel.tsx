/**
 * TimelineMarkerLabel displays a single line of text for timeline marker labels.
 * Used as a direct child of TimelineMarker with consistent styling.
 */

import { Text } from "@/components/ui";

type TimelineMarkerLabelProps = {
  /**
   * The label text to display (string only; no JSX children).
   */
  text: string;
};

/**
 * Renders a single label line for a timeline marker.
 *
 * @param text - The label string to display
 * @returns A Text component with timeline label styling, or null if text is empty
 */
const TimelineMarkerLabel = ({ text }: TimelineMarkerLabelProps) => {
  if (text === "") return null;
  return <Text className="text-xs text-muted-foreground">{text}</Text>;
};

export default TimelineMarkerLabel;
