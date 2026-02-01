/**
 * Renders text with consistent styling for progress meter labels.
 * Applies small text size with tight leading, and conditionally applies bold or light font weight.
 */

import type { PropsWithChildren } from "react";
import { Text } from "@/components/ui";

type TimelineLegendText = PropsWithChildren<{
  /**
   * Boolean to apply semibold font weight (default false, uses light weight).
   */
  bold?: boolean;
}>;

/**
 * Renders text with consistent styling for progress meter labels.
 * Applies small text size with tight leading, and conditionally applies bold or light font weight.
 *
 * @param bold - Optional boolean to apply semibold font weight (default false, uses light weight)
 * @param children - React node content to display as text
 * @returns A Text component with standardized label styling
 */
const TimelineLegendText = ({ bold, children }: TimelineLegendText) => (
  <Text
    className={`text-xs tracking-tight leading-tight ${bold ? "font-semibold" : "font-light "}`}
  >
    {children}
  </Text>
);

export default TimelineLegendText;
