/**
 * Victor Mono body line for timeline rows (labels and plain time strings).
 */

import type { PropsWithChildren } from "react";
import { Text } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";

type TimelineRowTextProps = PropsWithChildren<{
  theme: TimelineVisualTheme;
}>;

/**
 * Themed monospace label for timeline row content.
 *
 * @param theme - Row text color from the active visual theme
 * @param children - String content
 * @returns Themed `Text`
 */
const TimelineRowText = ({ children, theme }: TimelineRowTextProps) => (
  <Text
    className="font-victor-mono-400"
    style={{
      color: theme.text.bodyColor,
    }}
  >
    {children}
  </Text>
);

export { TimelineRowText };
