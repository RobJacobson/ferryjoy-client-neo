/**
 * TimelineMarkerLabel displays a single line of text for timeline marker labels.
 * Used as a direct child of TimelineMarker with consistent styling.
 */

import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";

type TimelineMarkerLabelProps = {
  /**
   * The label text to display (string only; no JSX children).
   */
  text: string;
  /**
   * Optional className for additional styling on the text.
   * Merged with default font-playpen-200 text-xs styling.
   */
  className?: string;
};

/**
 * Renders a single label line for a timeline marker.
 *
 * @param text - The label string to display
 * @param className - Optional className for additional styling on the text
 * @returns A Text component with timeline label styling, or null if text is empty
 */
const TimelineMarkerLabel = ({ text, className }: TimelineMarkerLabelProps) => {
  if (text === "") return null;
  return (
    <Text className={cn("font-playpen-200 text-sm", className)}>{text}</Text>
  );
};

export default TimelineMarkerLabel;
