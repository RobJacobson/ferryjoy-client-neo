/**
 * Left-column event label for timeline rows.
 */

import { Text, View } from "@/components/ui";
import { TIMELINE_SIDE_COLUMN_OFFSET_PX } from "../config";
import {
  DEFAULT_TIMELINE_VISUAL_THEME,
  type TimelineVisualTheme,
} from "../theme";
import type { TimelineRenderBoundary } from "../types";
import { TimelineShadowText } from "./TimelineShadowText";

type TimelineRowEventLabelProps = {
  boundary: TimelineRenderBoundary;
  theme?: TimelineVisualTheme;
};

/**
 * Renders event label text and terminal name for a timeline row boundary.
 *
 * @param label - The boundary containing event and terminal data
 * @returns The label view or a spacer when no display text is available
 */
export const TimelineRowEventLabel = ({
  boundary,
  theme = DEFAULT_TIMELINE_VISUAL_THEME,
}: TimelineRowEventLabelProps) => {
  const terminalDisplayName = boundary.currTerminalDisplayName;

  const labelText =
    boundary.eventType === "arrive"
      ? boundary.currTerminalAbbrev
        ? `Arv: ${boundary.currTerminalAbbrev}`
        : "Arv"
      : boundary.nextTerminalAbbrev
        ? `To: ${boundary.nextTerminalAbbrev}`
        : "Dep";

  return (
    <View
      className="relative mx-2 mt-[-8px] flex-1 flex-row"
      style={{ paddingRight: TIMELINE_SIDE_COLUMN_OFFSET_PX }}
    >
      {terminalDisplayName && boundary.eventType === "arrive" && (
        <View
          className="absolute -top-8 -left-3"
          style={{
            transform: [
              { rotate: `${theme.labels.terminalNameRotationDeg}deg` },
            ],
          }}
        >
          <TimelineShadowText
            shadowClassName=""
            shadowStyle={{ color: theme.labels.terminalNameShadowColor }}
          >
            <Text
              className={theme.labels.terminalNameFontClassName}
              style={[
                { color: theme.labels.terminalNameColor },
                theme.labels.terminalNameStyle,
              ]}
            >
              {terminalDisplayName}
            </Text>
          </TimelineShadowText>
        </View>
      )}
      <View className="flex-1 flex-row justify-end">
        <TimelineShadowText
          shadowClassName=""
          shadowStyle={{ color: theme.labels.eventLabelShadowColor }}
        >
          <Text
            className={`mt-[-6px] ${theme.labels.eventLabelFontClassName}`}
            style={[
              { color: theme.labels.eventLabelColor },
              theme.labels.eventLabelStyle,
            ]}
          >
            {labelText}
          </Text>
        </TimelineShadowText>
      </View>
    </View>
  );
};
